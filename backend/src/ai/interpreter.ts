import { z } from 'zod';
import { ApiError } from '../errors.js';

// Turns a free-text conviction into a structured interpretation (E1 rules 3 and 8).
// The provider is not chosen yet: tests use a fake, and production answers 503 AI_UNAVAILABLE
// until a real adapter exists. Whatever an adapter returns is untrusted: the route checks it
// against `aiInterpretationSchema` before using any of it (SEGURANCA: output outside the schema
// is rejected).
export interface ConvictionInterpreter {
  interpret(conviction: string): Promise<unknown>;
}

const label = z.string().trim().min(1).max(200);

// Labels only; the server assigns the ids. Unknown keys are rejected, not ignored.
export const aiInterpretationSchema = z.strictObject({
  summary: z.string().trim().min(1).max(500),
  exposures: z.array(label).max(10),
  exclusions: z.array(label).max(10),
  restrictions: z.array(label).max(10),
  ambiguities: z
    .array(
      z.strictObject({
        question: label,
        // true: the answer changes the proposal, so it must be answered before moving on (RF-07).
        material: z.boolean(),
        options: z.array(label).min(2).max(5),
      }),
    )
    .max(5),
  representation: z.enum(['sufficient', 'partial', 'insufficient']),
  limitations: z.array(z.string().trim().min(1).max(500)).max(10),
});

export type AiInterpretation = z.infer<typeof aiInterpretationSchema>;

export function aiUnavailable(): ApiError {
  return new ApiError(
    503,
    'AI_UNAVAILABLE',
    'Interpretation is temporarily unavailable. Try again or pick a suggested thesis.',
  );
}

export const noInterpreterYet: ConvictionInterpreter = {
  async interpret() {
    throw aiUnavailable();
  },
};
