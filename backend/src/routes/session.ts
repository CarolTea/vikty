import { randomBytes } from 'node:crypto';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { ApiError } from '../errors.js';
import { ANON_FREE_INTERPRETATIONS, quotaWindow } from '../quota.js';

export const SESSION_COOKIE = 'victy_session';
// Same window as the anonymous quota (24h), renewed on every visit so the cookie never expires
// while the quota counter is still running.
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24; // 24 hours

const quotaSchema = {
  type: 'object',
  required: ['limit', 'remaining', 'resetsAt'],
  properties: {
    limit: { type: 'integer' },
    remaining: { type: 'integer' },
    resetsAt: { type: 'string', format: 'date-time' },
  },
} as const;

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

// A valid signed cookie keeps its session (and gets 24h more); a missing or tampered one gets a
// fresh session.
function readOrCreateSession(request: FastifyRequest, reply: FastifyReply, secure: boolean): string {
  let sessionId: string | null = null;
  const raw = request.cookies[SESSION_COOKIE];
  if (raw) {
    const { valid, value } = request.unsignCookie(raw);
    if (valid && value) sessionId = value;
  }
  sessionId ??= randomBytes(32).toString('base64url');

  reply.setCookie(SESSION_COOKIE, sessionId, {
    signed: true,
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return sessionId;
}

// No header → anonymous. A header that is not a proper bearer token is a client bug: 401.
function bearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (header === undefined) return null;
  const match = /^Bearer ([A-Za-z0-9._~+/=-]+)$/.exec(header);
  if (!match?.[1]) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Your session has expired. Connect your wallet again.');
  }
  return match[1];
}
