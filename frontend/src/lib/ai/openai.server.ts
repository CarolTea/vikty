import { thesisLanguage } from "./language";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { AIProvider } from "../demo/providers";
import type { DemoMessage } from "../demo/types";
import { CATALOG_TAGS, getCatalogAsset, modelAsset } from "../assets/catalog-utils";
import {
  clarificationSchema,
  interpretationSchema,
  compositionSchema,
  answerSchema,
  type CompositionInput,
  type AnswerInput,
} from "./schemas";
import { validateComposition, validateAnswer } from "./validation";
import { PROMPT_VERSION, VICTY_THESIS_INSTRUCTIONS } from "./prompts/victy-thesis";

import { enforceScope, scopeSchema, SCOPE_INSTRUCTIONS } from "./scope";

export const DEFAULT_OPENAI_MODEL = "gpt-5.6-luna";
export class OpenAIProvider implements AIProvider {
  private client: OpenAI;
  private model: string;
  constructor(client?: OpenAI, model = process.env["OPENAI_MODEL"] || DEFAULT_OPENAI_MODEL) {
    if (!client && !process.env["OPENAI_API_KEY"])
      throw new Error(
        "VicTy AI is not configured. Please try again after the server configuration is complete.",
      );
    this.client =
      client ??
      new OpenAI({ apiKey: process.env["OPENAI_API_KEY"], timeout: 20_000, maxRetries: 1 });
    this.model = model;
  }
  private async request<T extends z.ZodTypeAny>(
    operation: string,
    schema: T,
    data: unknown,
    maxTokens: number,
    validate?: (value: z.infer<T>) => z.infer<T>,
    instructions = VICTY_THESIS_INSTRUCTIONS,
  ): Promise<z.infer<T>> {
    const belief =
      data && typeof data === "object" && "belief" in data && typeof data.belief === "string"
        ? data.belief
        : "";
    const language = thesisLanguage(belief);
    const input = JSON.stringify(data);
    if (input.length > 36_000)
      throw new Error("This request is too large. Please shorten your thesis or question.");
    if (operation !== "scope_check") await this.checkScope(operation, data);
    const start = Date.now();
    let inputTokens = 0;
    let outputTokens = 0;
    let status = "error";
    try {
      const response = await this.client.responses.parse({
        model: this.model,
        instructions: `${instructions}\n${operation === "scope_check" ? "" : `Required output language: ${language === "pt" ? "Portuguese" : "English"}. This applies to every natural-language field; never copy a different language from catalog metadata or earlier responses.`}\nOperation: ${operation}. Prompt version: ${PROMPT_VERSION}.`,
        input,
        store: false,
        reasoning: { effort: "low" },
        max_output_tokens: maxTokens,
        text: { format: zodTextFormat(schema, operation) },
      });
      inputTokens = response.usage?.input_tokens ?? 0;
      outputTokens = response.usage?.output_tokens ?? 0;
      if (response.status !== "completed" || !response.output_parsed) {
        status = "incomplete_or_refused";
        throw new Error("No valid output");
      }
      const parsed = schema.safeParse(response.output_parsed);
      if (!parsed.success) {
        status = "invalid_output";
        throw new Error("Invalid output");
      }
      status = "invalid_output";
      const result = validate ? validate(parsed.data) : parsed.data;
      status = "ok";
      return result;
    } catch {
      throw new Error(
        "VicTy could not complete this AI request. Your progress is preserved; please try again.",
      );
    } finally {
      console.info("victy.ai", {
        operation,
        model: this.model,
        latencyMs: Date.now() - start,
        inputTokens,
        outputTokens,
        status,
      });
    }
  }
  private async checkScope(operation: string, data: unknown) {
    const result = await this.request(
      "scope_check",
      scopeSchema,
      { operation, data },
      600,
      undefined,
      SCOPE_INSTRUCTIONS,
    );
    enforceScope(result);
  }
  async clarify(belief: string, answer?: string, count = 0, messages: DemoMessage[] = []) {
    if (count >= 3) {
      await this.checkScope("clarify", { belief, answer, conversation: messages });
      return {
        ready: true,
        question: null,
        options: [],
        reason: "Clarification limit reached; interpret with explicit limitations.",
      };
    }
    const result = await this.request(
      "clarify",
      clarificationSchema,
      {
        belief,
        answer: answer ?? null,
        questionsAlreadyAsked: count,
        conversation: messages.slice(-8).map(({ role, text }) => ({ role, text })),
        taxonomy: CATALOG_TAGS,
      },
      1000,
    );
    if (
      (result.ready && (result.question !== null || result.options.length)) ||
      (!result.ready && !result.question)
    )
      throw new Error("VicTy could not clarify the thesis. Please try again.");
    return result;
  }
  interpret(belief: string, messages: DemoMessage[]) {
    return this.request(
      "interpret",
      interpretationSchema,
      {
        belief,
        conversation: messages.slice(-8).map(({ role, text }) => ({ role, text })),
        taxonomy: CATALOG_TAGS,
      },
      3000,
    );
  }
  proposeComposition(input: CompositionInput) {
    return this.request(
      "propose_composition",
      compositionSchema,
      {
        belief: input.belief,
        interpretation: input.interpretation,
        candidates: input.candidates.map(modelAsset),
      },
      3500,
      (value) => validateComposition(value, input.candidates),
    );
  }
  answer(question: string, state: AnswerInput) {
    const assets = state.assets.map((a) => {
      const catalog = getCatalogAsset(a.id);
      if (!catalog)
        throw new Error(
          "This composition uses an older catalog. Start a new demo to ask VicTy about it.",
        );
      return { ...modelAsset(catalog), allocation: a.allocation, rejected: !a.active };
    });
    return this.request(
      "answer",
      answerSchema,
      {
        question,
        belief: state.belief,
        interpretation: state.interpretation,
        exposures: state.exposures,
        assets,
      },
      3500,
      (value) =>
        validateAnswer(
          value,
          state.assets.map((a) => getCatalogAsset(a.id)!),
          state.assets,
        ),
    );
  }
}
