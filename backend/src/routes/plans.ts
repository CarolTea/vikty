import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { canAccess } from '../auth/session.js';
import type { DraftItem } from '../composition.js';
import { ApiError } from '../errors.js';
import { newPlanId, type PlanRecord } from '../plans.js';
import {
  applyEdits,
  decimal,
  draftBody,
  draftItemsSchema,
  idParam,
  ownerOf,
  presentDraft,
  proposalItemSchema,
  stringList,
  validationSchema,
} from './shared.js';

const createBody = {
  type: 'object',
  required: ['proposalId', 'budgetUsdc', 'items'],
  properties: { proposalId: { type: 'string', maxLength: 64 }, budgetUsdc: decimal, items: draftItemsSchema },
} as const;

// PlanActivation. `status` can only become active: a plan never goes back to draft.
const activationBody = {
  type: 'object',
  required: ['status', 'trackedMints', 'confirmPreexistingBalances'],
  properties: {
    status: { const: 'active' },
    trackedMints: { type: 'array', maxItems: 50, items: { type: 'string', maxLength: 64 } },
    confirmPreexistingBalances: { type: 'boolean' },
  },
} as const;

// Response schemas double as allowlists: the wallet and the stored composition stay inside.
const planSchema = {
  type: 'object',
  required: ['id', 'proposalId', 'status', 'version', 'budgetUsdc', 'items', 'validation', 'trackedMints', 'interpretationSummary', 'createdAt', 'updatedAt'],
  properties: {
    id: { type: 'string' },
    proposalId: { type: 'string' },
    status: { type: 'string' },
    version: { type: 'integer' },
    budgetUsdc: { type: 'string' },
    items: { type: 'array', items: proposalItemSchema },
    validation: validationSchema,
    trackedMints: stringList,
    interpretationSummary: { type: 'string' },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
  },
} as const;

const listSchema = {
  type: 'object',
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'status', 'version', 'budgetUsdc', 'interpretationSummary', 'createdAt', 'updatedAt'],
        properties: {
          id: { type: 'string' },
          status: { type: 'string' },
          version: { type: 'integer' },
          budgetUsdc: { type: 'string' },
          interpretationSummary: { type: 'string' },
          createdAt: { type: 'string' },
          updatedAt: { type: 'string' },
        },
      },
    },
  },
} as const;

type Draft = { budgetUsdc: string; items: DraftItem[] };

export const planRoutes: FastifyPluginAsync = async (app) => {
  const { proposals, interpretations, plans, catalog } = app.deps;

  // Plans belong to a wallet: every route needs a Privy token (contract: W).
  async function walletOf(request: FastifyRequest, reply: FastifyReply): Promise<string> {
    const { wallet } = await ownerOf(app.deps, request, reply);
    if (!wallet) throw new ApiError(401, 'UNAUTHENTICATED', 'Connect your wallet to continue.');
    return wallet;
  }

  async function ownPlan(id: string, wallet: string): Promise<PlanRecord> {
    const plan = await plans.get(id);
    if (!plan || plan.wallet !== wallet) throw new ApiError(404, 'NOT_FOUND', 'Not found.');
    return plan;
  }

  async function planBody(plan: PlanRecord) {
    const { validation, items } = await presentDraft(app.deps, plan, plan.budgetUsdc, plan.items);
    return {
      id: plan.id,
      proposalId: plan.proposalId,
      status: plan.status,
      version: plan.version,
      budgetUsdc: plan.budgetUsdc,
      items,
      validation,
      trackedMints: plan.trackedMints,
      interpretationSummary: plan.interpretationSummary,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    };
  }

  // The validator must pass (warnings don't count); otherwise PLAN_INVALID with the validation.
  async function requireValid(plan: Pick<PlanRecord, 'items' | 'exposures' | 'excludedInstrumentIds'>, draft: Draft) {
    const { items, foreign } = applyEdits(plan, draft.items);
    const { validation } = await presentDraft(app.deps, plan, draft.budgetUsdc, items, foreign);
    if (!validation.valid) {
      throw new ApiError(422, 'PLAN_INVALID', 'This plan has issues to fix before it can be saved.', { validation });
    }
    return items;
  }

  // Saves a draft from a proposal of this session or wallet (the draft made before connecting).
  app.post<{ Body: Draft & { proposalId: string } }>(
    '/plans',
    { schema: { body: createBody, response: { 201: planSchema } } },
    async (request, reply) => {
      const owner = await ownerOf(app.deps, request, reply);
      if (!owner.wallet) throw new ApiError(401, 'UNAUTHENTICATED', 'Connect your wallet to continue.');
      const proposal = await proposals.get(request.body.proposalId);
      if (!proposal || !canAccess(proposal, owner)) throw new ApiError(404, 'NOT_FOUND', 'Not found.');

      const items = await requireValid(proposal, request.body);
      const interpretation = await interpretations.get(proposal.interpretationId);
      const now = new Date().toISOString();
      const plan: PlanRecord = {
        id: newPlanId(),
        wallet: owner.wallet,
        proposalId: proposal.id,
        interpretationSummary: interpretation?.summary ?? '',
        status: 'draft',
        version: 1,
        budgetUsdc: request.body.budgetUsdc,
        items,
        exposures: proposal.exposures,
        excludedInstrumentIds: proposal.excludedInstrumentIds,
        trackedMints: [],
        confirmPreexistingBalances: false,
        createdAt: now,
        updatedAt: now,
      };
      await plans.create(plan);

      reply.status(201).header('Location', `${request.routeOptions.url}/${plan.id}`);
      return planBody(plan);
    },
  );

  app.get('/plans', { schema: { response: { 200: listSchema } } }, async (request, reply) => {
    const wallet = await walletOf(request, reply);
    return { items: await plans.listByWallet(wallet) };
  });

  app.get<{ Params: { id: string } }>(
    '/plans/:id',
    { schema: { params: idParam, response: { 200: planSchema } } },
    async (request, reply) => {
      const wallet = await walletOf(request, reply);
      return planBody(await ownPlan(request.params.id, wallet));
    },
  );

  // A new version of weights, rejections and budget. Retried on top of a concurrent change, which a
  // full replacement makes safe.
  app.put<{ Params: { id: string }; Body: Draft }>(
    '/plans/:id',
    { schema: { params: idParam, body: draftBody, response: { 200: planSchema } } },
    async (request, reply) => {
      const wallet = await walletOf(request, reply);
      for (let attempt = 0; attempt < 3; attempt++) {
        const plan = await ownPlan(request.params.id, wallet);
        const items = await requireValid(plan, request.body);
        const next: PlanRecord = {
          ...plan,
          items,
          budgetUsdc: request.body.budgetUsdc,
          version: plan.version + 1,
          updatedAt: new Date().toISOString(),
        };
        if (await plans.update(next, plan.version, false)) return planBody(next);
      }
      throw new Error('plan kept changing under concurrent updates');
    },
  );

  // Activation, and later changes of the tracked mints: only mints of the plan's active items.
  app.patch<{ Params: { id: string }; Body: { status: 'active'; trackedMints: string[]; confirmPreexistingBalances: boolean } }>(
    '/plans/:id',
    { schema: { params: idParam, body: activationBody, response: { 200: planSchema } } },
    async (request, reply) => {
      const wallet = await walletOf(request, reply);
      for (let attempt = 0; attempt < 3; attempt++) {
        const plan = await ownPlan(request.params.id, wallet);
        const mints = new Set(
          plan.items.filter((i) => i.state === 'active').flatMap((i) => catalog.find(i.instrumentId)?.mint ?? []),
        );
        const trackedMints = [...new Set(request.body.trackedMints)];
        if (trackedMints.some((m) => !mints.has(m))) {
          throw new ApiError(400, 'VALIDATION_ERROR', 'Some fields are invalid.', { fields: ['trackedMints'] });
        }
        await requireValid(plan, { budgetUsdc: plan.budgetUsdc, items: plan.items });

        const next: PlanRecord = {
          ...plan,
          status: 'active',
          trackedMints,
          confirmPreexistingBalances: request.body.confirmPreexistingBalances,
          updatedAt: new Date().toISOString(),
        };
        if (await plans.update(next, plan.version, true)) return planBody(next);
      }
      throw new Error('plan kept changing under concurrent updates');
    },
  );
};
