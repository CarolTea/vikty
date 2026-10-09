import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { outOfScope } from './guard.js';
import { aiInterpretationSchema, type AiInterpretation, type ConvictionInterpreter } from './interpreter.js';
import { INTERPRET_INSTRUCTIONS, PROMPT_VERSION, SCOPE_INSTRUCTIONS } from './prompts.js';

export const DEFAULT_AI_MODEL = 'gpt-5.6-luna';

const scopeSchema = z.strictObject({
  verdict: z.enum(['IN_SCOPE', 'OUT_OF_SCOPE', 'NEEDS_CLARIFICATION']),
});

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
    const { verdict } = await this.request('scope_check', SCOPE_INSTRUCTIONS, scopeSchema, input, 300);
    if (verdict === 'OUT_OF_SCOPE') throw outOfScope('unrelated');
    if (verdict === 'NEEDS_CLARIFICATION') throw outOfScope('unclear');
    return this.request('interpret', INTERPRET_INSTRUCTIONS, aiInterpretationSchema, input, 3000);
  }

  private async request<T extends z.ZodType>(
    operation: string,
    instructions: string,
    schema: T,
    input: string,
    maxOutputTokens: number,
  ): Promise<z.infer<T>> {
    const response = await this.client.responses.parse({
      model: this.model,
      instructions: `${instructions}\nOperation: ${operation}. Prompt version: ${PROMPT_VERSION}.`,
      input,
      // The conviction is not stored by us (contract) and shouldn't be by the provider either.
      store: false,
      reasoning: { effort: 'low' },
      max_output_tokens: maxOutputTokens,
      text: { format: zodTextFormat(schema, operation) },
    });
    if (response.status !== 'completed' || response.output_parsed == null) {
      throw new Error(`${operation}: no usable output (status ${response.status})`);
    }
    return schema.parse(response.output_parsed);
  }
}

export function openAIInterpreter(apiKey: string, model: string): OpenAIInterpreter {
  return new OpenAIInterpreter(new OpenAI({ apiKey, timeout: 20_000, maxRetries: 1 }), model);
}
