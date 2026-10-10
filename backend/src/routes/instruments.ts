import type { FastifyPluginAsync } from 'fastify';
import { instrumentSummary, riskLabels } from '../catalog/instruments.js';
import { ApiError } from '../errors.js';
import { availabilitySchema, idParam, instrumentSummarySchema, stringList, UNKNOWN_AVAILABILITY } from './shared.js';

// InstrumentDetail. Response schema doubles as an allowlist.
const detailSchema = {
  type: 'object',
  required: ['instrument', 'represents', 'issuer', 'economicRights', 'limitations', 'risks', 'costs', 'howToTrade', 'availability', 'evidence', 'eligibilityNotes'],
  properties: {
    instrument: instrumentSummarySchema,
    represents: { type: 'string' },
    issuer: {
      type: 'object',
      required: ['name', 'nature'],
      properties: { name: { type: 'string' }, nature: { type: 'string' } },
    },
    economicRights: stringList,
    limitations: stringList,
    risks: stringList,
    costs: stringList,
    howToTrade: { type: 'string' },
    availability: availabilitySchema,
    evidence: {
      type: 'array',
      items: {
        type: 'object',
        required: ['label', 'url', 'reviewedAt'],
        properties: { label: { type: 'string' }, url: { type: 'string' }, reviewedAt: { type: 'string' } },
      },
    },
    eligibilityNotes: stringList,
  },
} as const;

export const instrumentRoutes: FastifyPluginAsync = async (app) => {
  const { catalog, availability } = app.deps;

  // Only instruments that can be explained in full: a confirmed mint and reviewed detail, which is
  // what approval requires. Anything else is 404, like an id that doesn't exist.
  app.get<{ Params: { id: string } }>(
    '/instruments/:id',
    { schema: { params: idParam, response: { 200: detailSchema } } },
    async (request, reply) => {
      const instrument = catalog.find(request.params.id);
      if (!instrument?.mint || !instrument.detail) throw new ApiError(404, 'NOT_FOUND', 'Not found.');
      const { detail } = instrument;
      const available = (await availability.check([instrument.id])).get(instrument.id) ?? UNKNOWN_AVAILABILITY;

      // Availability is momentary, so the answer is too.
      reply.header('Cache-Control', 'no-store');
      return {
        instrument: instrumentSummary(instrument),
        represents: instrument.represents,
        issuer: { name: instrument.issuerName ?? instrument.name, nature: detail.issuerNature },
        economicRights: detail.economicRights,
        limitations: detail.limitations,
        risks: riskLabels(instrument),
        costs: detail.costs,
        howToTrade: detail.howToTrade,
        availability: available,
        evidence: instrument.evidence,
        eligibilityNotes: detail.eligibilityNotes,
      };
    },
  );
};
