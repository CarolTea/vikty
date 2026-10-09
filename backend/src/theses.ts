import type { InterpretationContent } from './interpretations.js';
import type { Composition } from './proposals.js';

// Suggested theses: curated ahead of time, so choosing one costs no AI call and no quota (E1 rule 1).
export interface SuggestedThesis {
  id: string;
  title: string;
  summary: string;
  text: string;
  interpretation: InterpretationContent;
  // Curated composition, used instead of the AI (no quota, `curated: true`). Absent until the
  // catalog has approved instruments for the thesis: the proposal then says so in its limitations.
  composition?: Composition;
}

// Placeholder taken from the examples in Docs/api/openapi.yaml. The real list depends on what the
// catalog can represent (spike S1) and replaces this one when that is decided.
export const suggestedTheses: SuggestedThesis[] = [
  {
    id: 'th_ai_infra',
    title: 'AI infrastructure',
    summary: 'Chips, data centers and the energy that power AI.',
    text: 'AI will reshape data center infrastructure over the next 5 years.',
    interpretation: {
      summary: 'Growing demand for physical AI infrastructure.',
      exposures: [
        { id: 'exp_semis_ai', label: 'AI semiconductors' },
        { id: 'exp_datacenter', label: 'Data centers' },
      ],
      exclusions: [],
      restrictions: [],
      ambiguities: [],
      representation: 'sufficient',
      limitations: [],
    },
  },
];

export function findSuggestedThesis(id: string): SuggestedThesis | undefined {
  return suggestedTheses.find((t) => t.id === id);
}
