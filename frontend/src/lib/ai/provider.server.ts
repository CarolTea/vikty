import type { AIProvider } from "../demo/providers";
import { MockAIProvider } from "../demo/providers";
import { OpenAIProvider } from "./openai.server";
export function getAIProvider(): AIProvider {
  const provider = process.env["AI_PROVIDER"] || "openai";
  if (provider === "mock" && process.env["NODE_ENV"] === "development") return new MockAIProvider();
  if (provider !== "openai")
    throw new Error("Mock AI is allowed only through explicit development configuration.");
  return new OpenAIProvider();
}
