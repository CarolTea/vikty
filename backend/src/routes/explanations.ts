import type { FastifyBaseLogger, FastifyPluginAsync } from 'fastify';
import { aiExplanationSchema, checkExplanation, type AiExplanation, type ExplanationInput, type ProposalExplainer } from '../ai/explainer.js';
import { normalizeText, outOfScope, screenConviction } from '../ai/guard.js';
import { aiUnavailable } from '../ai/interpreter.js';
import { canAccess } from '../auth/session.js';
import { ApiError } from '../errors.js';
import { answeredQuestions, type InterpretationRecord } from '../interpretations.js';
import { idParam, ownerOf, requireHuman, reserve, stringList } from './shared.js';

type Body = { question: string; instrumentId?: string; botCheckToken?: string };

// ExplanationInput. `question` has no maxLength here: the limit is configuration and answers
// TEXT_TOO_LONG, like the conviction.
const bodySchema = {
  type: 'object',
  required: ['question'],
  properties: {
    question: { type: 'string' },
    instrumentId: { type: 'string', maxLength: 64 },
    botCheckToken: { type: 'string', maxLength: 2048 },
  },
} as const;

const explanationSchema = {
  type: 'object',
  required: ['explanation', 'limitations', 'remaining'],
  properties: {
    explanation: { type: 'string' },
    limitations: stringList,
    remaining: { type: 'integer' },
  },
} as const;

export const explanationRoutes: FastifyPluginAsync = async (app) => {
  const { config, quota, interpretations, proposals, explainer, catalog } = app.deps;

  // "Ask VicTy". Checks the question before spending anything, then reserves one of the proposal's
  // questions and gives it back if the AI fails or finds the question out of scope.
  app.post<{ Params: { id: string }; Body: Body }>(
    '/proposals/:id/explanations',
    { schema: { params: idParam, body: bodySchema, response: { 200: explanationSchema } } },
    async (request, reply) => {
      const owner = await ownerOf(app.deps, request, reply);
      const proposal = await proposals.get(request.params.id);
      if (!proposal || !canAccess(proposal, owner)) throw new ApiError(404, 'NOT_FOUND', 'Not found.');

      const { instrumentId } = request.body;
      if (instrumentId !== undefined && !proposal.items.some((i) => i.instrumentId === instrumentId)) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Some fields are invalid.', { fields: ['instrumentId'] });
      }
      const question = checkQuestion(request.body.question, config.EXPLANATION_MAX_CHARS);
      if (!owner.wallet) await requireHuman(app.deps, request.body.botCheckToken, request.ip);

      const limit = config.EXPLANATIONS_PER_PROPOSAL;
      const release = await reserve(
        () => quota.reserveExplanation(proposal.id),
        () => quota.releaseExplanation(proposal.id),
        limit,
        () => new ApiError(403, 'EXPLANATIONS_USED', "You've asked all the questions this composition allows.", { limit }),
      );

      // The interpretation behind the proposal: it always exists (foreign key), but stay safe.
      const interpretation = await interpretations.get(proposal.interpretationId);
      const input: ExplanationInput = {
        question,
        instrumentId: instrumentId ?? null,
        thesis: thesisOf(interpretation),
        items: proposal.items.map((item) => {
          const instrument = catalog.find(item.instrumentId);
          return {
            instrumentId: item.instrumentId,
            symbol: instrument?.symbol ?? item.instrumentId,
            name: instrument?.name ?? item.instrumentId,
            represents: instrument?.represents ?? '',
            exposureLabel: instrument?.exposureLabel ?? '',
            issuerName: instrument?.issuerName ?? null,
            exposureIds: item.exposureIds,
            weightBps: item.weightBps,
            state: item.state,
            rationale: item.rationale,
            riskTags: instrument?.riskTags ?? [],
          };
        }),
        limitations: proposal.limitations,
      };

      let answer: AiExplanation;
      try {
        answer = await explain(explainer, input, request.log);
      } catch (err) {
        await release().catch((releaseErr: unknown) => request.log.error({ err: releaseErr }, 'could not give the question back'));
        throw err;
      }

      const used = await quota.explanationsUsed(proposal.id);
      return { ...answer, remaining: Math.max(0, limit - used) };
    },
  );
};

// Normalized and checked like the conviction, before any AI call or question is spent.
function checkQuestion(text: string, max: number): string {
  const question = normalizeText(text);
  if (!question) throw new ApiError(400, 'VALIDATION_ERROR', 'Some fields are invalid.', { fields: ['question'] });
  if (question.length > max) throw new ApiError(400, 'TEXT_TOO_LONG', `Your question is over ${max} characters.`, { max });
  const refused = screenConviction(question);
  if (refused) throw outOfScope(refused, 'question');
  return question;
}

function thesisOf(interpretation: InterpretationRecord | null): ExplanationInput['thesis'] {
  if (!interpretation) return { summary: '', exposures: [], exclusions: [], restrictions: [], answers: [] };
  return {
    summary: interpretation.summary,
    exposures: interpretation.exposures,
    exclusions: interpretation.exclusions.map((e) => e.label),
    restrictions: interpretation.restrictions.map((r) => r.label),
    answers: answeredQuestions(interpretation),
  };
}

// OUT_OF_SCOPE from the adapter passes through; any other failure is AI_UNAVAILABLE, and so is an
// answer outside the schema or one that fails the checks. Only paths and codes are logged.
async function explain(explainer: ProposalExplainer, input: ExplanationInput, log: FastifyBaseLogger): Promise<AiExplanation> {
  let raw: unknown;
  try {
    raw = await explainer.explain(input);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    log.error({ err }, 'explainer failed');
    throw aiUnavailable();
  }
  const parsed = aiExplanationSchema.safeParse(raw);
  if (!parsed.success) {
    log.warn({ issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), code: i.code })) }, 'explainer answer outside the schema');
    throw aiUnavailable();
  }
  const checked = checkExplanation(parsed.data);
  if (!checked.ok) {
    log.warn({ problems: checked.problems }, 'explainer answer failed the checks');
    throw aiUnavailable();
  }
  return checked.value;
}
