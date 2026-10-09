import type { FastifyBaseLogger, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { aiCompositionSchema, candidateOf, checkComposition, policyLimits, type CompositionInput } from '../ai/composer.js';
import { aiUnavailable } from '../ai/interpreter.js';
import { bearerToken, canAccess, readOrCreateSession, sessionHash, type Owner } from '../auth/session.js';
import { instrumentSummary, riskLabels } from '../catalog/instruments.js';
import {
  duplicateInstrumentIds,
  policyFromConfig,
  validateDraft,
  type Availability,
  type DraftItem,
  type ValidationContext,
} from '../composition.js';
import { ApiError } from '../errors.js';
import type { InterpretationRecord } from '../interpretations.js';
import { newProposalId, type Composition, type ProposalRecord, type StoredItem } from '../proposals.js';
import { findSuggestedThesis } from '../theses.js';

// Design system copy: a limitation is an answer, not an error.
const NO_REPRESENTATION =
  "We couldn't find enough representation in the catalog for this thesis. We'd rather not substitute something similar.";

const decimal = { type: 'string', pattern: '^-?\\d+(\\.\\d+)?$', maxLength: 32 } as const;
const idParam = { type: 'object', required: ['id'], properties: { id: { type: 'string', maxLength: 64 } } } as const;

const createBody = {
  type: 'object',
  required: ['interpretationId', 'budgetUsdc'],
  properties: {
    interpretationId: { type: 'string', maxLength: 64 },
    budgetUsdc: decimal,
  },
} as const;

// ProposalEditInput.
const editBody = {
  type: 'object',
  required: ['budgetUsdc', 'items'],
  properties: {
    budgetUsdc: decimal,
    items: {
      type: 'array',
      maxItems: 50,
      items: {
        type: 'object',
        required: ['instrumentId', 'weightBps', 'state'],
        properties: {
          instrumentId: { type: 'string', maxLength: 64 },
          weightBps: { type: 'integer', minimum: 0, maximum: 10_000 },
          state: { type: 'string', enum: ['active', 'rejected'] },
        },
      },
    },
  },
} as const;

// Response schemas double as allowlists: fields not listed here are never serialized.
const stringList = { type: 'array', items: { type: 'string' } } as const;

const proposalItemSchema = {
  type: 'object',
  required: ['instrument', 'exposureIds', 'weightBps', 'plannedUsdc', 'rationale', 'risks', 'availability', 'state'],
  properties: {
    instrument: {
      type: 'object',
      required: ['id', 'symbol', 'name', 'mint', 'decimals', 'kind', 'status', 'exposureLabel', 'issuerName'],
      properties: {
        id: { type: 'string' },
        symbol: { type: 'string' },
        name: { type: 'string' },
        mint: { type: 'string' },
        decimals: { type: 'integer' },
        kind: { type: 'string' },
        status: { type: 'string' },
        exposureLabel: { type: 'string' },
        issuerName: { type: ['string', 'null'] },
      },
    },
    exposureIds: stringList,
    weightBps: { type: 'integer' },
    plannedUsdc: { type: 'string' },
    rationale: { type: 'string' },
    risks: stringList,
    availability: {
      type: 'object',
      required: ['buy', 'sell', 'checkedAt'],
      properties: {
        buy: { type: 'string' },
        sell: { type: 'string' },
        checkedAt: { type: ['string', 'null'] },
      },
    },
    state: { type: 'string' },
  },
} as const;

const validationSchema = {
  type: 'object',
  required: ['valid', 'conclusive', 'totalBps', 'issues', 'policyVersion'],
  properties: {
    valid: { type: 'boolean' },
    conclusive: { type: 'boolean' },
    totalBps: { type: 'integer' },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        required: ['code', 'severity', 'instrumentId', 'message', 'params'],
        properties: {
          code: { type: 'string' },
          severity: { type: 'string' },
          instrumentId: { type: ['string', 'null'] },
          message: { type: 'string' },
          params: { type: 'object', additionalProperties: { type: ['string', 'number'] } },
        },
      },
    },
    policyVersion: { type: 'string' },
  },
} as const;

const proposalSchema = {
  type: 'object',
  required: ['id', 'interpretationId', 'curated', 'budgetUsdc', 'items', 'validation', 'limitations'],
  properties: {
    id: { type: 'string' },
    interpretationId: { type: 'string' },
    curated: { type: 'boolean' },
    budgetUsdc: { type: 'string' },
    items: { type: 'array', items: proposalItemSchema },
    validation: validationSchema,
    limitations: stringList,
  },
} as const;

const validationResultSchema = {
  type: 'object',
  required: ['validation', 'items'],
  properties: {
    validation: validationSchema,
    items: { type: 'array', items: proposalItemSchema },
  },
} as const;

export const proposalRoutes: FastifyPluginAsync = async (app) => {
  const { config, wallets, interpretations, proposals, composer, catalog, availability } = app.deps;
  const policy = policyFromConfig(config);

  async function ownerOf(request: FastifyRequest, reply: FastifyReply): Promise<Owner> {
    reply.header('Cache-Control', 'no-store');
    reply.header('Vary', 'Authorization, Cookie');
    const sessionId = readOrCreateSession(request, reply, config.NODE_ENV === 'production');
    const token = bearerToken(request);
    return { sessionHash: sessionHash(sessionId), wallet: token ? await wallets.resolve(token) : null };
  }

  async function ownProposal(id: string, owner: Owner): Promise<ProposalRecord> {
    const record = await proposals.get(id);
    if (!record || !canAccess(record, owner)) throw new ApiError(404, 'NOT_FOUND', 'Not found.');
    return record;
  }

  // Validates `items` (edits included) against the proposal and serves them as ProposalItems.
  async function present(record: ProposalRecord, budgetUsdc: string, items: StoredItem[], extra: DraftItem[] = []) {
    const available = await availability.check(record.items.map((i) => i.instrumentId));
    const draft: DraftItem[] = [...items.map(({ instrumentId, weightBps, state }) => ({ instrumentId, weightBps, state })), ...extra];
    const ctx: ValidationContext = {
      policy,
      proposalItems: record.items,
      exposures: record.exposures,
      excludedInstrumentIds: record.excludedInstrumentIds,
      availability: available,
      lookup: catalog.find,
    };
    const { validation, plannedUsdc } = validateDraft(budgetUsdc, draft, ctx);
    return {
      validation,
      items: items.map((item) => proposalItem(item, plannedUsdc.get(item.instrumentId) ?? '0.00', available.get(item.instrumentId))),
    };
  }

  function proposalItem(item: StoredItem, plannedUsdc: string, available: Availability | undefined) {
    const instrument = catalog.find(item.instrumentId);
    // Items were approved (mint confirmed) when proposed; a registry entry removed since is a bug.
    if (!instrument) throw new Error(`instrument ${item.instrumentId} left the registry`);
    return {
      instrument: instrumentSummary(instrument),
      exposureIds: item.exposureIds,
      weightBps: item.weightBps,
      plannedUsdc,
      rationale: item.rationale,
      risks: riskLabels(instrument),
      availability: available ?? { buy: 'unknown', sell: 'unknown', checkedAt: null },
      state: item.state,
    };
  }

  async function proposalBody(record: ProposalRecord) {
    const { validation, items } = await present(record, record.budgetUsdc, record.items);
    return {
      id: record.id,
      interpretationId: record.interpretationId,
      curated: record.curated,
      budgetUsdc: record.budgetUsdc,
      items,
      validation,
      limitations: record.limitations,
    };
  }

  // At most one AI call per interpretation: a new budget reuses the latest composition.
  async function compositionFor(interpretation: InterpretationRecord, log: FastifyBaseLogger): Promise<Composition> {
    const previous = await proposals.latestFor(interpretation.id);
    if (previous) {
      return {
        items: previous.items,
        excludedInstrumentIds: previous.excludedInstrumentIds,
        limitations: previous.limitations,
      };
    }

    const nothing: Composition = { items: [], excludedInstrumentIds: [], limitations: [NO_REPRESENTATION] };
    if (interpretation.source === 'suggested') {
      return findSuggestedThesis(interpretation.suggestedThesisId ?? '')?.composition ?? nothing;
    }

    const candidates = catalog.approved();
    if (interpretation.representation === 'insufficient' || !candidates.some((c) => c.kind !== 'cash')) return nothing;

    const input: CompositionInput = {
      thesis: {
        summary: interpretation.summary,
        exposures: interpretation.exposures,
        exclusions: interpretation.exclusions.map((e) => e.label),
        restrictions: interpretation.restrictions.map((r) => r.label),
      },
      candidates: candidates.map(candidateOf),
      policy: policyLimits(policy),
    };
    return compose(input, log);
  }

  // Any adapter failure is AI_UNAVAILABLE, and so is an answer outside the schema or one that fails
  // the checks. Only paths and codes are logged, never values.
  async function compose(input: CompositionInput, log: FastifyBaseLogger): Promise<Composition> {
    let raw: unknown;
    try {
      raw = await composer.compose(input);
    } catch (err) {
      log.error({ err }, 'composer failed');
      throw aiUnavailable();
    }

    const parsed = aiCompositionSchema.safeParse(raw);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => ({ path: i.path.join('.'), code: i.code }));
      log.warn({ issues }, 'composer answer outside the schema');
      throw aiUnavailable();
    }
    const checked = checkComposition(parsed.data, input);
    if (!checked.ok) {
      log.warn({ problems: checked.problems }, 'composer answer failed the checks');
      throw aiUnavailable();
    }
    return checked.value;
  }

  app.post<{ Body: { interpretationId: string; budgetUsdc: string } }>(
    '/proposals',
    { schema: { body: createBody, response: { 201: proposalSchema } } },
    async (request, reply) => {
      const owner = await ownerOf(request, reply);
      const interpretation = await interpretations.get(request.body.interpretationId);
      if (!interpretation || !canAccess(interpretation, owner)) throw new ApiError(404, 'NOT_FOUND', 'Not found.');
      if (interpretation.status !== 'ready') {
        const open = interpretation.ambiguities.filter((a) => a.material && a.answer === null).map((a) => a.id);
        throw new ApiError(422, 'INTERPRETATION_NOT_READY', 'Answer the open questions about your thesis to see a composition.', {
          ambiguityIds: open,
        });
      }

      const composition = await compositionFor(interpretation, request.log);
      const record: ProposalRecord = {
        id: newProposalId(),
        interpretationId: interpretation.id,
        ...owner,
        curated: interpretation.source === 'suggested',
        budgetUsdc: request.body.budgetUsdc,
        // A new proposal starts with every item active, whatever was edited on an earlier one.
        items: composition.items.map((i) => ({ ...i, state: 'active' })),
        exposures: interpretation.exposures,
        excludedInstrumentIds: composition.excludedInstrumentIds,
        limitations: [...new Set([...interpretation.limitations, ...composition.limitations])],
      };
      await proposals.create(record);

      reply.status(201).header('Location', `${request.routeOptions.url}/${record.id}`);
      return proposalBody(record);
    },
  );

  app.get<{ Params: { id: string } }>(
    '/proposals/:id',
    { schema: { params: idParam, response: { 200: proposalSchema } } },
    async (request, reply) => {
      const owner = await ownerOf(request, reply);
      return proposalBody(await ownProposal(request.params.id, owner));
    },
  );

  // Deterministic and not stored, hence 200. The draft is complete: a proposal item it leaves out
  // counts as rejected. An instrument from outside the proposal is reported, never served as an item.
  app.post<{ Params: { id: string }; Body: { budgetUsdc: string; items: DraftItem[] } }>(
    '/proposals/:id/validations',
    { schema: { params: idParam, body: editBody, response: { 200: validationResultSchema } } },
    async (request, reply) => {
      const owner = await ownerOf(request, reply);
      const record = await ownProposal(request.params.id, owner);
      const { budgetUsdc, items } = request.body;
      if (duplicateInstrumentIds(items).length) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Some fields are invalid.', { fields: ['items'] });
      }

      const edits = new Map(items.map((i) => [i.instrumentId, i]));
      const edited: StoredItem[] = record.items.map((item) => {
        const edit = edits.get(item.instrumentId);
        return { ...item, weightBps: edit?.weightBps ?? 0, state: edit?.state ?? 'rejected' };
      });
      const offered = new Set(record.items.map((i) => i.instrumentId));
      const foreign = items.filter((i) => !offered.has(i.instrumentId));
      return present(record, budgetUsdc, edited, foreign);
    },
  );
};
