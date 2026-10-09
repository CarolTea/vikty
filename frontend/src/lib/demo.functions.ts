import { createServerFn } from "@tanstack/react-start";
import { randomBytes } from "crypto";
import { credentialsSchema, stateSchema, messageSchema, exposureSchema } from "./demo/schemas";
import { z } from "zod";
import { interpretationSchema } from "./ai/schemas";

export const createDemoSession = createServerFn({ method: "POST" }).handler(async () => {
  const { hashSecret } = await import("./demo/session.server");
  const secret = randomBytes(32).toString("base64url");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("demo_sessions")
    .insert({
      secret_hash: hashSecret(secret),
      state: {
        step: "input",
        belief: "",
        messages: [],
        clarificationCount: 0,
        interpretation: "",
        exposures: [],
        assets: [],
        investments: [],
      },
    })
    .select("id")
    .single();
  if (error || !data) throw new Error("Demo session unavailable");
  return { id: data.id, secret };
});

export const loadDemoSession = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => credentialsSchema.parse(input))
  .handler(async ({ data }) => {
    const { verifiedSession } = await import("./demo/session.server");
    const session = await verifiedSession(data);
    return session ? { ok: true as const, state: session.state } : { ok: false as const };
  });

export const saveDemoSession = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ ...credentialsSchema.shape, state: stateSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const { verifiedSession } = await import("./demo/session.server");
    const session = await verifiedSession(data);
    if (!session) return { ok: false as const };
    const { error } = await session.supabaseAdmin
      .from("demo_sessions")
      .update({ state: data.state, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    return { ok: !error };
  });

const aiMessagesSchema = z.array(messageSchema).max(8);
const beliefSchema = z.string().trim().min(10).max(2000);

export const interpretThesis = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({ credentials: credentialsSchema, belief: beliefSchema, messages: aiMessagesSchema })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { getAIProvider } = await import("./ai/provider.server");
    const { withAISession } = await import("./ai/engine.server");
    return withAISession(data.credentials, async () => {
      const result = interpretationSchema.parse(
        await getAIProvider().interpret(data.belief, data.messages),
      );
      return {
        interpretation: result.summary,
        exposures: result.exposures,
        limitations: result.limitations,
      };
    });
  });
export const clarifyThesis = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        credentials: credentialsSchema,
        belief: beliefSchema,
        answer: z.string().trim().min(1).max(1000).optional(),
        count: z.number().int().min(0).max(3),
        messages: aiMessagesSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { getAIProvider } = await import("./ai/provider.server");
    const { withAISession } = await import("./ai/engine.server");
    return withAISession(data.credentials, async () => {
      const result = await getAIProvider().clarify(
        data.belief,
        data.answer,
        data.count,
        data.messages,
      );
      const messages = [
        { id: crypto.randomUUID(), role: "user" as const, text: data.answer ?? data.belief },
        ...(!result.ready && result.question
          ? [
              {
                id: crypto.randomUUID(),
                role: "assistant" as const,
                text: result.question,
                options: result.options,
              },
            ]
          : []),
      ];
      return { messages, ready: result.ready };
    });
  });
export const generateComposition = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        credentials: credentialsSchema,
        belief: beliefSchema,
        interpretation: interpretationSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { getAIProvider } = await import("./ai/provider.server");
    const { withAISession, proposeThesis } = await import("./ai/engine.server");
    return withAISession(data.credentials, () =>
      proposeThesis(getAIProvider(), data.belief, data.interpretation),
    );
  });
export const askAboutComposition = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        credentials: credentialsSchema,
        question: z.string().trim().min(2).max(1000),
        state: z.object({
          belief: beliefSchema,
          interpretation: z.string().min(10).max(4000),
          exposures: z.array(exposureSchema).max(8),
          assets: z
            .array(
              z.object({
                id: z.string().max(80),
                allocation: z.number().min(0).max(100),
                active: z.boolean(),
              }),
            )
            .min(1)
            .max(12),
        }),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { getAIProvider } = await import("./ai/provider.server");
    const { withAISession, answerThesis } = await import("./ai/engine.server");
    return withAISession(data.credentials, () =>
      answerThesis(getAIProvider(), data.question, data.state),
    );
  });
