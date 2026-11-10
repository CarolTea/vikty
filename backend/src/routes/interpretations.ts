import type { FastifyBaseLogger, FastifyPluginAsync } from 'fastify';
import { checkInterpretation, normalizeText, screenConviction, outOfScope } from '../ai/guard.js';
import { aiInterpretationSchema, aiUnavailable, type ConvictionInterpreter } from '../ai/interpreter.js';
import { bearerToken, canAccess, readOrCreateSession, sessionHash, type Owner } from '../auth/session.js';
import { ApiError } from '../errors.js';
import {
  applyPatch,
  contentFromAi,
  newInterpretationId,
  statusOf,
  type InterpretationContent,
  type InterpretationPatch,
  type InterpretationRecord,
} from '../interpretations.js';
import { ANON_FREE_INTERPRETATIONS, quotaSchema, quotaWindow } from '../quota.js';
import { findSuggestedThesis } from '../theses.js';
import { idParam, ownerOf, requireHuman, reserve } from './shared.js';

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

const idList = { type: 'array', maxItems: 20, items: { type: 'string', maxLength: 64 } } as const;
const labelList = { type: 'array', maxItems: 10, items: { type: 'string', maxLength: 200 } } as const;

// InterpretationPatch. Every field optional; an empty body changes nothing.
const patchSchema = {
  type: 'object',
  properties: {
    answers: {
      type: 'array',
      maxItems: 10,
      items: {
        type: 'object',
        required: ['ambiguityId', 'optionId'],
        properties: {
          ambiguityId: { type: 'string', maxLength: 64 },
          optionId: { type: 'string', maxLength: 64 },
        },
      },
    },
    removeExposureIds: idList,
    addExclusions: labelList,
    removeExclusionIds: idList,
    addRestrictions: labelList,
    removeRestrictionIds: idList,
  },
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
  const { config, quota, wallets, interpreter, interpretations } = app.deps;

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
        if (!wallet) await requireHuman(app.deps, body.botCheckToken, request.ip);

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
        ...publicFields(record),
        quota: {
          anonymousFreeUsed: anonUsed >= ANON_FREE_INTERPRETATIONS,
          wallet: wallet ? { limit, remaining: Math.max(0, limit - walletUsed), resetsAt } : null,
        },
      };
    },
  );

  async function ownInterpretation(id: string, owner: Owner): Promise<InterpretationRecord> {
    const record = await interpretations.get(id);
    if (!record || !canAccess(record, owner)) throw new ApiError(404, 'NOT_FOUND', 'Not found.');
    return record;
  }

  // Reloading the Interpretation screen. No quota in the answer: it belongs to creating one.
  app.get<{ Params: { id: string } }>(
    '/interpretations/:id',
    { schema: { params: idParam, response: { 200: interpretationSchema } } },
    async (request, reply) => {
      const owner = await ownerOf(app.deps, request, reply);
      return publicFields(await ownInterpretation(request.params.id, owner));
    },
  );

  // Structured corrections and answers: no AI, no quota. Saved only on the version it was applied
  // to; when another correction got there first, it is applied again on top of that one.
  app.patch<{ Params: { id: string }; Body: InterpretationPatch }>(
    '/interpretations/:id',
    { schema: { params: idParam, body: patchSchema, response: { 200: interpretationSchema } } },
    async (request, reply) => {
      const owner = await ownerOf(app.deps, request, reply);
      for (let attempt = 0; attempt < 3; attempt++) {
        const record = await ownInterpretation(request.params.id, owner);
        const next = applyPatch(record, request.body);
        if (next === record || (await interpretations.update(next))) return publicFields(next);
      }
      throw new Error('interpretation kept changing under concurrent corrections');
    },
  );
};

// Normalized first, so invisible characters neither count nor reach the AI. Blank text is a
// validation error; over the configured limit is TEXT_TOO_LONG with details.max (counted in UTF-16
// units, like the browser's maxlength on the front). Text that can't be a conviction is refused here,
// before any quota or AI call.
function checkConviction(text: string, max: number): string {
  const conviction = normalizeText(text);
  if (!conviction) throw new ApiError(400, 'VALIDATION_ERROR', 'Some fields are invalid.', { fields: ['text'] });
  if (conviction.length > max) {
    throw new ApiError(400, 'TEXT_TOO_LONG', `Your thesis is over ${max} characters.`, { max });
  }
  const refused = screenConviction(conviction);
  if (refused) throw outOfScope(refused);
  return conviction;
}

// OUT_OF_SCOPE from the adapter passes through; any other failure is AI_UNAVAILABLE, and so is an
// answer outside the schema or one that fails the output checks. Only paths and codes are logged,
// never values: they may echo the person's text.
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

  const checked = checkInterpretation(parsed.data, conviction);
  if (!checked.ok) {
    log.warn({ problems: checked.problems }, 'interpreter answer failed the output checks');
    throw aiUnavailable();
  }
  return contentFromAi(checked.value);
}

// The contract's Interpretation, without owner, version or quota.
function publicFields(r: InterpretationRecord) {
  return {
    id: r.id,
    source: r.source,
    curated: r.curated,
    summary: r.summary,
    exposures: r.exposures,
    exclusions: r.exclusions,
    restrictions: r.restrictions,
    ambiguities: r.ambiguities,
    representation: r.representation,
    limitations: r.limitations,
    status: r.status,
  };
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
    version: 1,
  };
}
