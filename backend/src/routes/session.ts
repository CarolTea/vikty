import type { FastifyPluginAsync } from 'fastify';
import { bearerToken, readOrCreateSession } from '../auth/session.js';
import { ANON_FREE_INTERPRETATIONS, quotaSchema, quotaWindow } from '../quota.js';

// Response schema doubles as an allowlist: fields not listed here are never serialized.
const sessionSchema = {
  type: 'object',
  required: ['anonymous', 'wallet', 'activePlanId', 'activeOperationIds', 'limits'],
  properties: {
    anonymous: {
      type: 'object',
      required: ['freeInterpretationAvailable'],
      properties: { freeInterpretationAvailable: { type: 'boolean' } },
    },
    wallet: {
      type: ['object', 'null'],
      required: ['address', 'network', 'quota'],
      properties: {
        address: { type: 'string' },
        network: { type: 'string' },
        quota: quotaSchema,
      },
    },
    activePlanId: { type: ['string', 'null'] },
    activeOperationIds: { type: 'array', items: { type: 'string' } },
    limits: {
      type: 'object',
      required: ['convictionMaxChars'],
      properties: { convictionMaxChars: { type: 'integer' } },
    },
  },
} as const;

export const sessionRoutes: FastifyPluginAsync = async (app) => {
  const { config, quota, wallets, plans } = app.deps;
  const network = `solana-${config.SOLANA_CLUSTER.replace(/-beta$/, '')}`;

  app.get('/session', { schema: { response: { 200: sessionSchema } } }, async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    reply.header('Vary', 'Authorization, Cookie');

    const sessionId = readOrCreateSession(request, reply, config.NODE_ENV === 'production');
    const accessToken = bearerToken(request);
    const walletAddress = accessToken ? await wallets.resolve(accessToken) : null;

    const anonUsed = await quota.anonymousUsed(sessionId);

    let wallet = null;
    let activePlanId: string | null = null;
    let activeOperationIds: string[] = [];
    if (walletAddress) {
      const { day, resetsAt } = quotaWindow(new Date());
      const used = await quota.walletUsed(walletAddress, day);
      const limit = config.WALLET_DAILY_INTERPRETATIONS;
      wallet = {
        address: walletAddress,
        network,
        quota: { limit, remaining: Math.max(0, limit - used), resetsAt },
      };
      [activePlanId, activeOperationIds] = await Promise.all([
        plans.activePlanId(walletAddress),
        plans.activeOperationIds(walletAddress),
      ]);
    }

    return {
      anonymous: { freeInterpretationAvailable: anonUsed < ANON_FREE_INTERPRETATIONS },
      wallet,
      activePlanId,
      activeOperationIds,
      limits: { convictionMaxChars: config.CONVICTION_MAX_CHARS },
    };
  });
};
