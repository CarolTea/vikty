import type { FastifyPluginAsync } from 'fastify';
import { representable, suggestedTheses } from '../theses.js';

// Response schema doubles as an allowlist: the curated interpretation and composition stay inside.
const listSchema = {
  type: 'object',
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'title', 'summary', 'text'],
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          summary: { type: 'string' },
          text: { type: 'string' },
        },
      },
    },
  },
} as const;

export const thesisRoutes: FastifyPluginAsync = async (app) => {
  const { catalog } = app.deps;

  // Same answer for everyone; it changes only when the catalog does.
  app.get('/theses/suggested', { schema: { response: { 200: listSchema } } }, async (_request, reply) => {
    reply.header('Cache-Control', 'public, max-age=300');
    return { items: suggestedTheses.filter((t) => representable(t, catalog)) };
  });
};
