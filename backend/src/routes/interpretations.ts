import type { FastifyBaseLogger, FastifyPluginAsync } from 'fastify';
import { aiInterpretationSchema, aiUnavailable, type ConvictionInterpreter } from '../ai/interpreter.js';
import { bearerToken, readOrCreateSession, sessionHash } from '../auth/session.js';
import { ApiError } from '../errors.js';
import {
  contentFromAi,
  newInterpretationId,
  statusOf,
  type InterpretationContent,
  type InterpretationRecord,
} from '../interpretations.js';
import { ANON_FREE_INTERPRETATIONS, quotaSchema, quotaWindow } from '../quota.js';
import { findSuggestedThesis } from '../theses.js';

type Body =
  | { source: 'free_text'; text: string; botCheckToken?: string; deviceHash?: string }
  | { source: 'suggested'; suggestedThesisId: string };

// InterpretationFromText | InterpretationFromSuggested. `text` has no maxLength here: the limit is
// configuration (CONVICTION_MAX_CHARS) and answers TEXT_TOO_LONG, not VALIDATION_ERROR.
const bodySchema = {
  type: 'object',
  required: ['source'],
  discriminator: { propertyName: 'source' },
  oneOf: [
    {
      type: 'object',
      required: ['source', 'text'],
      properties: {
        source: { const: 'free_text' },
        text: { type: 'string' },
        botCheckToken: { type: 'string', maxLength: 2048 },
        // FingerprintJS hash; accepted but not used until the fingerprint limit exists.
        deviceHash: { type: 'string', maxLength: 128 },
      },
    },
    {
      type: 'object',
      required: ['source', 'suggestedThesisId'],
      properties: {
        source: { const: 'suggested' },
        suggestedThesisId: { type: 'string', maxLength: 64 },
      },
    },
  ],
} as const;

const labeledItemSchema = {
  type: 'object',
  required: ['id', 'label'],
  properties: { id: { type: 'string' }, label: { type: 'string' } },
} as const;

const labeledListSchema = { type: 'array', items: labeledItemSchema } as const;

// Response schema doubles as an allowlist: fields not listed here are never serialized.
const interpretationSchema = {
  type: 'object',
  required: [
    'id',
    'source',
    'curated',
    'summary',
    'exposures',
    'exclusions',
    'restrictions',
    'ambiguities',
    'representation',
    'limitations',
    'status',
  ],
  properties: {
    id: { type: 'string' },
    source: { type: 'string' },
    curated: { type: 'boolean' },
    summary: { type: 'string' },
    exposures: labeledListSchema,
    exclusions: labeledListSchema,
    restrictions: labeledListSchema,
    ambiguities: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'question', 'material', 'options', 'answer'],
        properties: {
          id: { type: 'string' },
          question: { type: 'string' },
          material: { type: 'boolean' },
          options: labeledListSchema,
          answer: { type: ['string', 'null'] },
        },
      },
    },
    representation: { type: 'string' },
    limitations: { type: 'array', items: { type: 'string' } },
    status: { type: 'string' },
    quota: {
      type: 'object',
      properties: {
        anonymousFreeUsed: { type: 'boolean' },
        wallet: { anyOf: [{ type: 'null' }, quotaSchema] },
      },
    },
  },
} as const;

export const interpretationRoutes: FastifyPluginAsync = async (app) => {
  const { config, quota, wallets, botCheck, interpreter, interpretations } = app.deps;

  // - `suggested`: curated interpretation, no AI and no quota.
  // - `free_text` without a wallet: Turnstile, then the one free interpretation.
  // - `free_text` with a wallet: the wallet's daily quota.
  // The quota is reserved before calling the AI and given back if anything fails after that
  // (E1 rule 9: a failure keeps the draft and lets the person try again).
  app.post<{ Body: Body }>(
    '/interpretations',
    { schema: { body: bodySchema, response: { 201: interpretationSchema } } },
    async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      reply.header('Vary', 'Authorization, Cookie');

      const body = request.body;
      const conviction = body.source === 'free_text' ? checkConviction(body.text, config.CONVICTION_MAX_CHARS) : null;

      const sessionId = readOrCreateSession(request, reply, config.NODE_ENV === 'production');
      const accessToken = bearerToken(request);
      const wallet = accessToken ? await wallets.resolve(accessToken) : null;
      const { day, resetsAt } = quotaWindow(new Date());

      const owner = { sessionHash: sessionHash(sessionId), wallet };
      let record: InterpretationRecord;

      if (body.source === 'suggested') {
        const thesis = findSuggestedThesis(body.suggestedThesisId);
        if (!thesis) {
          throw new ApiError(400, 'VALIDATION_ERROR', 'Some fields are invalid.', { fields: ['suggestedThesisId'] });
        }
        record = buildRecord(owner, 'suggested', thesis.id, thesis.interpretation);
        await interpretations.create(record);
      } else {
        if (!wallet) await requireHuman(body.botCheckToken, request.ip);

        const release = wallet
          ? await reserve(
              () => quota.reserveWallet(wallet, day),
              () => quota.releaseWallet(wallet, day),
              config.WALLET_DAILY_INTERPRETATIONS,
              () =>
                new ApiError(403, 'WALLET_QUOTA_USED', "You've used today's interpretations. They reset at midnight UTC.", {
                  resetsAt,
                }),
            )
          : await reserve(
              () => quota.reserveAnonymous(sessionId),
              () => quota.releaseAnonymous(sessionId),
              ANON_FREE_INTERPRETATIONS,
              () =>
                new ApiError(
                  403,
                  'ANON_QUOTA_USED',
                  'You have used your free interpretation. Connect your wallet to interpret again.',
                ),
            );

        try {
          const content = await interpret(interpreter, conviction!, request.log);
          record = buildRecord(owner, 'free_text', null, content);
          await interpretations.create(record);
        } catch (err) {
          await release().catch((releaseErr: unknown) =>
            request.log.error({ err: releaseErr }, 'could not give the quota back'),
          );
          throw err;
        }
      }

      const [anonUsed, walletUsed] = await Promise.all([
        quota.anonymousUsed(sessionId),
        wallet ? quota.walletUsed(wallet, day) : Promise.resolve(0),
      ]);
      const limit = config.WALLET_DAILY_INTERPRETATIONS;

      reply.status(201).header('Location', `${request.routeOptions.url}/${record.id}`);
      return {
        id: record.id,
        source: record.source,
        curated: record.curated,
        summary: record.summary,
        exposures: record.exposures,
        exclusions: record.exclusions,
        restrictions: record.restrictions,
        ambiguities: record.ambiguities,
        representation: record.representation,
        limitations: record.limitations,
        status: record.status,
        quota: {
          anonymousFreeUsed: anonUsed >= ANON_FREE_INTERPRETATIONS,
          wallet: wallet ? { limit, remaining: Math.max(0, limit - walletUsed), resetsAt } : null,
        },
      };
    },
  );

  async function requireHuman(token: string | undefined, remoteIp: string): Promise<void> {
    if (!token || !(await botCheck.verify(token, remoteIp))) {
      throw new ApiError(403, 'BOT_CHECK_FAILED', "We couldn't verify you're human. Please try again.");
    }
  }
};

// Blank text is a validation error; over the configured limit is TEXT_TOO_LONG with details.max.
// Length is counted in UTF-16 units, like the browser's maxlength on the front.
function checkConviction(text: string, max: number): string {
  const conviction = text.trim();
  if (!conviction) throw new ApiError(400, 'VALIDATION_ERROR', 'Some fields are invalid.', { fields: ['text'] });
  if (conviction.length > max) {
    throw new ApiError(400, 'TEXT_TOO_LONG', `Your thesis is over ${max} characters.`, { max });
  }
  return conviction;
}

// Counts one use; over the limit it gives it straight back and refuses. Returns the release.
async function reserve(
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

// Any adapter failure is AI_UNAVAILABLE, and so is an answer outside the schema. Only paths and
// codes are logged, never values: they may echo the person's text.
async function interpret(
  interpreter: ConvictionInterpreter,
  conviction: string,
  log: FastifyBaseLogger,
): Promise<InterpretationContent> {
  let raw: unknown;
  try {
    raw = await interpreter.interpret(conviction);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    log.error({ err }, 'interpreter failed');
    throw aiUnavailable();
  }

  const parsed = aiInterpretationSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => ({ path: i.path.join('.'), code: i.code }));
    log.warn({ issues }, 'interpreter answer outside the schema');
    throw aiUnavailable();
  }
  return contentFromAi(parsed.data);
}

function buildRecord(
  owner: { sessionHash: string; wallet: string | null },
  source: 'free_text' | 'suggested',
  suggestedThesisId: string | null,
  content: InterpretationContent,
): InterpretationRecord {
  return {
    id: newInterpretationId(),
    ...owner,
    source,
    curated: source === 'suggested',
    suggestedThesisId,
    ...content,
    status: statusOf(content.ambiguities),
  };
}
