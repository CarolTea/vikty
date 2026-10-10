import { z } from 'zod';
import { forbiddenContent, normalizeText } from './guard.js';

// Answers a question about a proposal ("Why is this here?"). It only explains: no weights in its
// output, so it can't change the composition even if asked to. Whatever an adapter returns is
// untrusted: the route checks it against `aiExplanationSchema`, then `checkExplanation`.
export interface ProposalExplainer {
  explain(input: ExplanationInput): Promise<unknown>;
}

export interface ExplanationInput {
  question: string;
  // The asset the question is about, when the person asked from its card.
  instrumentId: string | null;
  thesis: {
    summary: string;
    exposures: { id: string; label: string }[];
    exclusions: string[];
    restrictions: string[];
    answers: { question: string; answer: string }[];
  };
  // The proposal as the person sees it: registry facts, weights and the reason each asset is there.
  items: {
    instrumentId: string;
    symbol: string;
    name: string;
    represents: string;
    exposureLabel: string;
    issuerName: string | null;
    exposureIds: string[];
    weightBps: number;
    state: 'active' | 'rejected';
    rationale: string;
    riskTags: readonly string[];
  }[];
  limitations: string[];
}

export const aiExplanationSchema = z.strictObject({
  explanation: z.string().trim().min(1).max(1200),
  limitations: z.array(z.string().trim().min(1).max(300)).max(5),
});

export type AiExplanation = z.infer<typeof aiExplanationSchema>;

export type ExplanationCheck = { ok: true; value: AiExplanation } | { ok: false; problems: string[] };

// Same output rules as the interpretation: normalized, no links, addresses or return promises.
// `problems` holds codes only, never values.
export function checkExplanation(ai: AiExplanation): ExplanationCheck {
  const problems = new Set<string>();
  const clean = (text: string) => {
    const out = normalizeText(text);
    if (!out) problems.add('empty_text');
    for (const problem of forbiddenContent(out)) problems.add(problem);
    return out;
  };
  const value = { explanation: clean(ai.explanation), limitations: [...new Set(ai.limitations.map(clean))] };
  return problems.size ? { ok: false, problems: [...problems] } : { ok: true, value };
}

export const noExplainerYet: ProposalExplainer = {
  async explain() {
    throw new Error('no AI explainer configured');
  },
};
