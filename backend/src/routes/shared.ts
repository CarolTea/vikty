import type { FastifyReply, FastifyRequest } from 'fastify';
import { bearerToken, readOrCreateSession, sessionHash, type Owner } from '../auth/session.js';
import { instrumentSummary, riskLabels } from '../catalog/instruments.js';
import {
  duplicateInstrumentIds,
  policyFromConfig,
  validateDraft,
  type Availability,
  type DraftItem,
  type ValidationContext,
} from '../composition.js';
import type { Deps } from '../deps.js';
import { ApiError } from '../errors.js';
import type { LabeledItem } from '../interpretations.js';
import type { StoredItem } from '../proposals.js';

// What proposals and plans share: request schemas, the ProposalItem and Validation responses, and
// validating a draft against the composition it came from.

export const decimal = { type: 'string', pattern: '^-?\\d+(\\.\\d+)?$', maxLength: 32 } as const;
export const idParam = { type: 'object', required: ['id'], properties: { id: { type: 'string', maxLength: 64 } } } as const;

// PlanItemInput[].
export const draftItemsSchema = {
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
} as const;

// ProposalEditInput, and the body of PUT /plans/{id}.
export const draftBody = {
  type: 'object',
  required: ['budgetUsdc', 'items'],
  properties: { budgetUsdc: decimal, items: draftItemsSchema },
} as const;

// Response schemas double as allowlists: fields not listed here are never serialized.
export const stringList = { type: 'array', items: { type: 'string' } } as const;

export const instrumentSummarySchema = {
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
} as const;

export const availabilitySchema = {
  type: 'object',
  required: ['buy', 'sell', 'checkedAt'],
  properties: {
    buy: { type: 'string' },
    sell: { type: 'string' },
    checkedAt: { type: ['string', 'null'] },
  },
} as const;

export const proposalItemSchema = {
  type: 'object',
  required: ['instrument', 'exposureIds', 'weightBps', 'plannedUsdc', 'rationale', 'risks', 'availability', 'state'],
  properties: {
    instrument: instrumentSummarySchema,
    exposureIds: stringList,
    weightBps: { type: 'integer' },
    plannedUsdc: { type: 'string' },
    rationale: { type: 'string' },
    risks: stringList,
    availability: availabilitySchema,
    state: { type: 'string' },
  },
} as const;

export const validationSchema = {
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

export const UNKNOWN_AVAILABILITY: Availability = { buy: 'unknown', sell: 'unknown', checkedAt: null };

// The anonymous session and, when a Privy token comes along, the wallet. Responses that depend on
// who asks are never cached.
export async function ownerOf(deps: Deps, request: FastifyRequest, reply: FastifyReply): Promise<Owner> {
  reply.header('Cache-Control', 'no-store');
  reply.header('Vary', 'Authorization, Cookie');
  const sessionId = readOrCreateSession(request, reply, deps.config.NODE_ENV === 'production');
  const token = bearerToken(request);
  return { sessionHash: sessionHash(sessionId), wallet: token ? await deps.wallets.resolve(token) : null };
}

// What a draft is checked against: the composition it came from.
export interface DraftBase {
  items: StoredItem[];
  exposures: LabeledItem[];
  excludedInstrumentIds: string[];
}

// A complete draft against its base: base items left out count as rejected; instruments from outside
// the base are kept apart (reported by the validator, never served as items). Duplicates are a 400.
export function applyEdits(base: DraftBase, input: DraftItem[]): { items: StoredItem[]; foreign: DraftItem[] } {
  if (duplicateInstrumentIds(input).length) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Some fields are invalid.', { fields: ['items'] });
  }
  const edits = new Map(input.map((i) => [i.instrumentId, i]));
  const items = base.items.map((item) => {
    const edit = edits.get(item.instrumentId);
    return { ...item, weightBps: edit?.weightBps ?? 0, state: edit?.state ?? ('rejected' as const) };
  });
  const offered = new Set(base.items.map((i) => i.instrumentId));
  return { items, foreign: input.filter((i) => !offered.has(i.instrumentId)) };
}

// Validates `items` (edits included) against the base and serves them as ProposalItems.
export async function presentDraft(deps: Deps, base: DraftBase, budgetUsdc: string, items: StoredItem[], foreign: DraftItem[] = []) {
  const { catalog, availability } = deps;
  const available = await availability.check(base.items.map((i) => i.instrumentId));
  const draft: DraftItem[] = [...items.map(({ instrumentId, weightBps, state }) => ({ instrumentId, weightBps, state })), ...foreign];
  const ctx: ValidationContext = {
    policy: policyFromConfig(deps.config),
    proposalItems: base.items,
    exposures: base.exposures,
    excludedInstrumentIds: base.excludedInstrumentIds,
    availability: available,
    lookup: catalog.find,
  };
  const { validation, plannedUsdc } = validateDraft(budgetUsdc, draft, ctx);
  return {
    validation,
    items: items.map((item) => {
      const instrument = catalog.find(item.instrumentId);
      // Items were approved (mint confirmed) when proposed; a registry entry removed since is a bug.
      if (!instrument) throw new Error(`instrument ${item.instrumentId} left the registry`);
      return {
        instrument: instrumentSummary(instrument),
        exposureIds: item.exposureIds,
        weightBps: item.weightBps,
        plannedUsdc: plannedUsdc.get(item.instrumentId) ?? '0.00',
        rationale: item.rationale,
        risks: riskLabels(instrument),
        availability: available.get(item.instrumentId) ?? UNKNOWN_AVAILABILITY,
        state: item.state,
      };
    }),
  };
}

// Turnstile, for anything that spends AI without a wallet.
export async function requireHuman(deps: Deps, token: string | undefined, remoteIp: string): Promise<void> {
  if (!token || !(await deps.botCheck.verify(token, remoteIp))) {
    throw new ApiError(403, 'BOT_CHECK_FAILED', "We couldn't verify you're human. Please try again.");
  }
}

// Counts one use; over the limit it gives it straight back and refuses. Returns the release, for when
// the work it paid for fails.
export async function reserve(
  take: () => Promise<number>,
  release: () => Promise<void>,
  limit: number,
  refusal: () => ApiError,
): Promise<() => Promise<void>> {
  const used = await take();
  if (used > limit) {
    await release();
    throw refusal();
  }
  return release;
}
