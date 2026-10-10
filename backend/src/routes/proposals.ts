import type { FastifyBaseLogger, FastifyPluginAsync } from 'fastify';
import { aiCompositionSchema, candidateOf, checkComposition, policyLimits, type CompositionInput } from '../ai/composer.js';
import { aiUnavailable } from '../ai/interpreter.js';
import { canAccess, type Owner } from '../auth/session.js';
import { policyFromConfig, type DraftItem } from '../composition.js';
import { ApiError } from '../errors.js';
import { answeredQuestions, type InterpretationRecord } from '../interpretations.js';
import { newProposalId, type Composition, type ProposalRecord } from '../proposals.js';
import { findSuggestedThesis } from '../theses.js';
import {
  applyEdits,
  decimal,
  draftBody,
  idParam,
  ownerOf,
  presentDraft,
  proposalItemSchema,
  stringList,
  validationSchema,
} from './shared.js';

// Design system copy: a limitation is an answer, not an error.
const NO_REPRESENTATION =
  "We couldn't find enough representation in the catalog for this thesis. We'd rather not substitute something similar.";

const createBody = {
  type: 'object',
  required: ['interpretationId', 'budgetUsdc'],
  properties: {
    interpretationId: { type: 'string', maxLength: 64 },
    budgetUsdc: decimal,
  },
} as const;

// Response schemas double as allowlists: fields not listed here are never serialized.
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
  const { config, interpretations, proposals, composer, catalog } = app.deps;
  const policy = policyFromConfig(config);

  async function ownProposal(id: string, owner: Owner): Promise<ProposalRecord> {
    const record = await proposals.get(id);
    if (!record || !canAccess(record, owner)) throw new ApiError(404, 'NOT_FOUND', 'Not found.');
    return record;
  }

  async function proposalBody(record: ProposalRecord) {
    const { validation, items } = await presentDraft(app.deps, record, record.budgetUsdc, record.items);
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
    const previous = await proposals.latestFor(interpretation.id, interpretation.version);
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
        answers: answeredQuestions(interpretation),
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
      const owner = await ownerOf(app.deps, request, reply);
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
        interpretationVersion: interpretation.version,
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
      const owner = await ownerOf(app.deps, request, reply);
      return proposalBody(await ownProposal(request.params.id, owner));
    },
  );

  // Deterministic and not stored, hence 200. The draft is complete: a proposal item it leaves out
  // counts as rejected. An instrument from outside the proposal is reported, never served as an item.
  app.post<{ Params: { id: string }; Body: { budgetUsdc: string; items: DraftItem[] } }>(
    '/proposals/:id/validations',
    { schema: { params: idParam, body: draftBody, response: { 200: validationResultSchema } } },
    async (request, reply) => {
      const owner = await ownerOf(app.deps, request, reply);
      const record = await ownProposal(request.params.id, owner);
      const { items, foreign } = applyEdits(record, request.body.items);
      return presentDraft(app.deps, record, request.body.budgetUsdc, items, foreign);
    },
  );
};
