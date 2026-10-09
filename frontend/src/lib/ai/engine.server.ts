import { thesisLanguage } from "./language";
import { ThesisScopeError } from "./scope";
import type { AIProvider } from "../demo/providers";
import { demoProviders } from "../demo/providers";
import { CATALOG_VERSION } from "../assets/catalog";
import { getCatalogAsset } from "../assets/catalog-utils";
import {
  interpretationSchema,
  type Interpretation,
  type AnswerInput,
  type AnswerResult,
} from "./schemas";
import { proposalToAssets, validateComposition, validateAnswer } from "./validation";
import type { DemoSessionCredentials } from "../demo/types";
import { verifiedSession } from "../demo/session.server";

// Best-effort per-worker abuse/duplicate guard; not a cross-region billing quota.
const requests = new Map<string, { count: number; expires: number; busy: boolean }>();
export async function withAISession<T>(credentials: DemoSessionCredentials, fn: () => Promise<T>) {
  if (!(await verifiedSession(credentials)))
    throw new Error("Demo session unavailable. Please refresh.");
  const now = Date.now();
  for (const [id, entry] of requests) if (entry.expires < now && !entry.busy) requests.delete(id);
  const entry = requests.get(credentials.id) ?? {
    count: 0,
    expires: now + 10 * 60_000,
    busy: false,
  };
  if (entry.busy) throw new Error("A VicTy request is already running. Please wait.");
  if (entry.count >= 30 || (!requests.has(credentials.id) && requests.size >= 1000))
    throw new Error("VicTy request limit reached. Please try again later.");
  entry.busy = true;
  entry.count++;
  requests.set(credentials.id, entry);
  try {
    return await fn();
  } finally {
    entry.busy = false;
  }
}
export async function proposeThesis(
  provider: AIProvider,
  belief: string,
  interpreted: Interpretation,
) {
  const interpretation = interpretationSchema.parse(interpreted);
  const language = thesisLanguage(belief);
  const candidates = demoProviders.assets.getCandidates(interpretation.exposures, language);
  if (!interpretation.exposures.length || candidates.missingPrimary || !candidates.assets.length)
    return {
      assets: [],
      compositionSummary:
        language === "pt"
          ? "Esta tese não pode ser representada adequadamente pelo catálogo aprovado."
          : "This thesis cannot be adequately represented by the approved catalog.",
      limitations: [
        ...candidates.limitations,
        language === "pt"
          ? "Nenhuma carteira completa foi proposta. Refine a tese ou aguarde uma cobertura mais ampla do catálogo."
          : "No complete portfolio was proposed. Refine the thesis or wait for broader catalog coverage.",
      ].slice(0, 16),
      catalogVersion: CATALOG_VERSION,
    };
  let proposal;
  try {
    proposal = validateComposition(
      await provider.proposeComposition({ belief, interpretation, candidates: candidates.assets }),
      candidates.assets,
    );
  } catch (error) {
    if (error instanceof ThesisScopeError) throw error;
    throw new Error("VicTy returned a composition that could not be validated. Please try again.");
  }
  return {
    assets: proposalToAssets(proposal),
    compositionSummary: proposal.summary,
    // The composition phase re-evaluates thesis risks with actual candidates.
    // Do not append stale pre-catalog conclusions to the validated proposal.
    limitations: [...new Set([...candidates.limitations, ...proposal.limitations])].slice(0, 16),
    catalogVersion: CATALOG_VERSION,
  };
}
export async function answerThesis(
  provider: AIProvider,
  question: string,
  state: AnswerInput,
): Promise<AnswerResult> {
  const allowed = state.assets.map((a) => getCatalogAsset(a.id));
  if (
    allowed.some((a) => !a) ||
    new Set(state.assets.map((a) => a.id)).size !== state.assets.length
  )
    throw new Error(
      "This composition is not compatible with the current catalog. Start a new demo to ask VicTy.",
    );
  try {
    const answer = validateAnswer(
      await provider.answer(question, state),
      allowed.filter((a) => !!a),
      state.assets,
    );
    return {
      kind: answer.kind,
      explanation: answer.explanation,
      limitations: answer.limitations,
      proposedAssets: answer.kind === "PROPOSED_CHANGE" ? proposalToAssets(answer) : null,
    };
  } catch (error) {
    if (error instanceof ThesisScopeError) throw error;
    throw new Error(
      "VicTy could not validate this answer. No allocations were changed. Please try again.",
    );
  }
}
