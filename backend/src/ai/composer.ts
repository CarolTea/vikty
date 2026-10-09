import { z } from 'zod';
import type { Instrument } from '../catalog/instruments.js';
import type { Policy } from '../composition.js';
import type { LabeledItem } from '../interpretations.js';
import { BPS_TOTAL } from '../money.js';
import type { Composition } from '../proposals.js';
import { forbiddenContent, normalizeText } from './guard.js';

// Turns a ready interpretation into a composition, choosing only among the candidates it is given
// (approved instruments, PRD §9.2). Whatever an adapter returns is untrusted: the route checks it
// against `aiCompositionSchema`, then `checkComposition`, before using any of it.
export interface ProposalComposer {
  compose(input: CompositionInput): Promise<unknown>;
}

export interface CompositionInput {
  thesis: {
    summary: string;
    exposures: LabeledItem[];
    exclusions: string[];
    restrictions: string[];
  };
  candidates: CandidateInstrument[];
  policy: { minWeightBps: number; maxWeightBps: number };
}

// What the model sees of an instrument: registry facts only, never prices or availability.
export interface CandidateInstrument {
  id: string;
  symbol: string;
  name: string;
  instrumentType: string;
  kind: string;
  exposureLabel: string;
  represents: string;
  issuerName: string | null;
  region: string;
  exposures: readonly string[];
  themes: readonly string[];
  riskTags: readonly string[];
}

export function candidateOf(i: Instrument): CandidateInstrument {
  return {
    id: i.id,
    symbol: i.symbol,
    name: i.name,
    instrumentType: i.instrumentType,
    kind: i.kind,
    exposureLabel: i.exposureLabel,
    represents: i.represents,
    issuerName: i.issuerName,
    region: i.region,
    exposures: i.exposures,
    themes: i.themes,
    riskTags: i.riskTags,
  };
}

const id = z.string().min(1).max(64);

export const aiCompositionSchema = z.strictObject({
  items: z
    .array(
      z.strictObject({
        instrumentId: id,
        exposureIds: z.array(id).max(10),
        weightBps: z.number().int().min(1).max(BPS_TOTAL),
        rationale: z.string().trim().min(1).max(400),
      }),
    )
    .max(8),
  // Candidates the thesis's exclusions rule out. They must not be items.
  excludedInstrumentIds: z.array(id).max(50),
  limitations: z.array(z.string().trim().min(1).max(500)).max(10),
});

export type AiComposition = z.infer<typeof aiCompositionSchema>;

export type CompositionCheck = { ok: true; value: Composition } | { ok: false; problems: string[] };

// What the schema can't check. `problems` holds codes only, never values.
export function checkComposition(ai: AiComposition, input: CompositionInput): CompositionCheck {
  const problems = new Set<string>();
  const candidates = new Set(input.candidates.map((c) => c.id));
  const exposures = new Set(input.thesis.exposures.map((e) => e.id));
  const excluded = new Set(ai.excludedInstrumentIds);
  const { minWeightBps, maxWeightBps } = input.policy;

  const seen = new Set<string>();
  for (const item of ai.items) {
    // PRD §9.2: the AI never introduces an instrument, not even an approved one it wasn't offered.
    if (!candidates.has(item.instrumentId)) problems.add('instrument_not_offered');
    if (seen.has(item.instrumentId)) problems.add('duplicate_instrument');
    seen.add(item.instrumentId);
    if (excluded.has(item.instrumentId)) problems.add('excluded_instrument_used');
    if (item.exposureIds.some((e) => !exposures.has(e))) problems.add('unknown_exposure');
    if (item.weightBps > maxWeightBps) problems.add('weight_above_max');
    if (item.weightBps < minWeightBps) problems.add('weight_below_min');
  }
  if (ai.excludedInstrumentIds.some((i) => !candidates.has(i))) problems.add('exclusion_not_offered');

  // Unassigned weight is allowed only when a limitation explains it (no forcing 100% with filler).
  const total = ai.items.reduce((sum, i) => sum + i.weightBps, 0);
  if (total > BPS_TOTAL) problems.add('weights_above_100');
  if (total < BPS_TOTAL && ai.limitations.length === 0) problems.add('unexplained_shortfall');

  const clean = (text: string) => {
    const out = normalizeText(text);
    if (!out) problems.add('empty_text');
    for (const problem of forbiddenContent(out)) problems.add(problem);
    return out;
  };
  const value: Composition = {
    items: ai.items.map((i) => ({
      instrumentId: i.instrumentId,
      exposureIds: [...new Set(i.exposureIds)],
      weightBps: i.weightBps,
      rationale: clean(i.rationale),
      state: 'active',
    })),
    excludedInstrumentIds: [...excluded],
    limitations: [...new Set(ai.limitations.map(clean))],
  };

  return problems.size ? { ok: false, problems: [...problems] } : { ok: true, value };
}

export function policyLimits(policy: Policy): CompositionInput['policy'] {
  return { minWeightBps: policy.minWeightBps, maxWeightBps: policy.maxWeightBps };
}

export const noComposerYet: ProposalComposer = {
  async compose() {
    throw new Error('no AI composer configured');
  },
};
