import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { aiCompositionSchema, type AiComposition, type CompositionInput, type ProposalComposer } from './composer.js';
import { outOfScope } from './guard.js';
import { aiInterpretationSchema, type AiInterpretation, type ConvictionInterpreter } from './interpreter.js';
import {
  COMPOSE_INSTRUCTIONS,
  COMPOSE_PROMPT_VERSION,
  INTERPRET_INSTRUCTIONS,
  PROMPT_VERSION,
  SCOPE_INSTRUCTIONS,
} from './prompts.js';

export const DEFAULT_AI_MODEL = 'gpt-5.6-luna';

const scopeSchema = z.strictObject({
  verdict: z.enum(['IN_SCOPE', 'OUT_OF_SCOPE', 'NEEDS_CLARIFICATION']),
});

export function openAIClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey, timeout: 20_000, maxRetries: 1 });
}

// Two calls per conviction: a scope gate that only classifies, then the interpretation. Keeping the
// gate separate means text that slips past it still meets a model told to interpret, not to obey.
// A text the gate rejects throws 422 OUT_OF_SCOPE. Any other failure (network, refusal, truncated or
// malformed output) throws too, and the route turns it into 503 AI_UNAVAILABLE. Either way the
// quota is given back. The route re-checks the answer (`aiInterpretationSchema`, then
// `checkInterpretation`), so this adapter is never trusted on its own.
export class OpenAIInterpreter implements ConvictionInterpreter {
  constructor(
    private readonly client: OpenAI,
    private readonly model: string = DEFAULT_AI_MODEL,
  ) {}

  async interpret(conviction: string): Promise<AiInterpretation> {
    const input = JSON.stringify({ conviction });
    const call = { client: this.client, model: this.model, version: PROMPT_VERSION, input };
    const { verdict } = await structured({ ...call, operation: 'scope_check', instructions: SCOPE_INSTRUCTIONS, schema: scopeSchema, maxOutputTokens: 300 });
    if (verdict === 'OUT_OF_SCOPE') throw outOfScope('unrelated');
    if (verdict === 'NEEDS_CLARIFICATION') throw outOfScope('unclear');
    return structured({ ...call, operation: 'interpret', instructions: INTERPRET_INSTRUCTIONS, schema: aiInterpretationSchema, maxOutputTokens: 3000 });
  }
}

// One call. Its input is our own stored interpretation and registry data, not the person's text, so
// there is no scope gate; the route checks the answer (`aiCompositionSchema`, `checkComposition`).
export class OpenAIComposer implements ProposalComposer {
  constructor(
    private readonly client: OpenAI,
    private readonly model: string = DEFAULT_AI_MODEL,
  ) {}

  compose(input: CompositionInput): Promise<AiComposition> {
    return structured({
      client: this.client,
      model: this.model,
      version: COMPOSE_PROMPT_VERSION,
      operation: 'compose',
      instructions: COMPOSE_INSTRUCTIONS,
      schema: aiCompositionSchema,
      input: JSON.stringify(input),
      maxOutputTokens: 3500,
    });
  }
}

async function structured<T extends z.ZodType>(call: {
  client: OpenAI;
  model: string;
  version: string;
  operation: string;
  instructions: string;
  schema: T;
  input: string;
  maxOutputTokens: number;
}): Promise<z.infer<T>> {
  const response = await call.client.responses.parse({
    model: call.model,
    instructions: `${call.instructions}\nOperation: ${call.operation}. Prompt version: ${call.version}.`,
    input: call.input,
    // The conviction is not stored by us (contract) and shouldn't be by the provider either.
    store: false,
    reasoning: { effort: 'low' },
    max_output_tokens: call.maxOutputTokens,
    text: { format: zodTextFormat(call.schema, call.operation) },
  });
  if (response.status !== 'completed' || response.output_parsed == null) {
    throw new Error(`${call.operation}: no usable output (status ${response.status})`);
  }
  return call.schema.parse(response.output_parsed);
}
