import { createHash } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import { bearerToken, readOrCreateSession, sessionHash } from '../auth/session.js';
import { CLIENT_EVENT_NAMES, type ClientEventName } from '../events.js';

type Body = {
  events: { name: ClientEventName; at: string; props?: Record<string, string | number | boolean> }[];
};

// Props are for small labels (e.g. `source: "suggested"`), never the conviction text or a wallet
// address: short strings only, and anything shaped like a Solana address is refused.
const SOLANA_ADDRESS = '^[1-9A-HJ-NP-Za-km-z]{32,44}$';

const bodySchema = {
  type: 'object',
  required: ['events'],
  properties: {
    events: {
      type: 'array',
      minItems: 1,
      maxItems: 50,
      items: {
        type: 'object',
        required: ['name', 'at'],
        properties: {
          name: { type: 'string', enum: CLIENT_EVENT_NAMES },
          at: { type: 'string', format: 'date-time' },
          props: {
            type: 'object',
            maxProperties: 10,
            propertyNames: { pattern: '^[a-zA-Z][a-zA-Z0-9_]{0,31}$' },
            additionalProperties: {
              anyOf: [
                { type: 'string', maxLength: 64, not: { pattern: SOLANA_ADDRESS } },
                { type: 'number' },
                { type: 'boolean' },
              ],
            },
          },
        },
      },
    },
  },
} as const;

export const eventRoutes: FastifyPluginAsync = async (app) => {
  const { config, wallets, events } = app.deps;

  app.post<{ Body: Body }>('/events', { schema: { body: bodySchema } }, async (request, reply) => {
    const sessionId = readOrCreateSession(request, reply, config.NODE_ENV === 'production');
    const accessToken = bearerToken(request);
    const wallet = accessToken ? await wallets.resolve(accessToken) : null;

    const owner = {
      sessionHash: sessionHash(sessionId),
      walletHash: wallet ? createHash('sha256').update(wallet).digest('hex') : null,
    };
    await events.record(
      request.body.events.map((e) => ({ name: e.name, occurredAt: e.at, props: e.props ?? {}, ...owner })),
    );

    return reply.status(204).send();
  });
};
