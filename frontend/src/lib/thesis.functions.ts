import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { performanceProvider } from "./thesis/performance";
import { mapThesis, selection, type ThesisRow } from "./thesis/queries";

const credentialsSchema = z.object({ id: z.string().uuid(), secret: z.string().min(40).max(200) });
const assetSchema = z.object({
  id: z.string().max(80),
  ticker: z.string().max(20),
  name: z.string().max(120),
  allocation: z.number().min(0).max(100),
  exposure: z.string().max(200),
  why: z.string().max(300),
  risks: z.string().max(300),
  availability: z.string().max(100),
  category: z.string().max(100),
  price: z.number().nonnegative(),
  active: z.boolean(),
});
const saveSchema = z.object({
  credentials: credentialsSchema,
  name: z.string().trim().max(100).optional(),
  belief: z.string().trim().min(10).max(2000),
  interpretation: z.string().trim().min(10).max(4000),
  assets: z.array(assetSchema).min(1).max(12),
});

export const saveTrackedThesis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => saveSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { createHash, timingSafeEqual } = await import("crypto");
    const hash = createHash("sha256").update(data.credentials.secret).digest("hex");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: session } = await supabaseAdmin
      .from("demo_sessions")
      .select("secret_hash")
      .eq("id", data.credentials.id)
      .maybeSingle();
    if (!session) throw new Error("Demo session unavailable");
    const expected = Buffer.from(session.secret_hash, "hex");
    const provided = Buffer.from(hash, "hex");
    if (expected.length !== provided.length || !timingSafeEqual(expected, provided))
      throw new Error("Demo session unavailable");

    const email =
      typeof context.claims.email === "string" ? context.claims.email.toLowerCase() : "";
    if (!email) throw new Error("Authenticated email unavailable");
    const cleanName = data.name?.trim().replace(/\s+/g, " ") ?? "";
    const { data: existingProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, name")
      .eq("id", context.userId)
      .maybeSingle();
    if (profileError) throw new Error("Profile could not be checked. Please try again.");
    let profileName = cleanName;
    if (!existingProfile) {
      const { data: lead } = await supabaseAdmin
        .from("early_access_signups")
        .select("name")
        .eq("email", email)
        .maybeSingle();
      if (profileName.length < 2 && lead?.name) profileName = lead.name;
      if (
        profileName.length < 2 &&
        typeof context.claims.user_metadata === "object" &&
        context.claims.user_metadata &&
        "name" in context.claims.user_metadata &&
        typeof context.claims.user_metadata["name"] === "string"
      )
        profileName = context.claims.user_metadata["name"];
      if (profileName.length < 2)
        profileName = email.split("@")[0]?.slice(0, 100) || "VicTy member";
    }
    profileName = (existingProfile?.name || profileName).slice(0, 100);
    if (profileName.length < 2) profileName = "VicTy member";
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("theses")
      .select("created_at")
      .eq("demo_session_id", data.credentials.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (existingError) throw new Error("Thesis could not be checked. Please try again.");
    const activeAssets = data.assets.filter((asset) => asset.active && asset.allocation > 0);
    if (
      !activeAssets.length ||
      new Set(activeAssets.map((asset) => asset.id)).size !== activeAssets.length
    )
      throw new Error("Choose at least one asset, without duplicates, before saving.");
    const createdAt = existing ? new Date(existing.created_at) : new Date();
    const initialAmount = 1000;
    const generated = performanceProvider.generate(
      data.credentials.id,
      activeAssets,
      initialAmount,
      createdAt,
    );
    const currentValue = generated.snapshots.at(-1)?.value ?? initialAmount;
    const title = data.belief.toLowerCase().includes("ai")
      ? "AI Infrastructure"
      : `${activeAssets[0]?.exposure ?? "Investment"} thesis`;
    const assetRows = activeAssets.map((asset) => {
      const multiplier = generated.assetMultipliers[asset.id] ?? 1;
      const initialValue = (initialAmount * asset.allocation) / 100;
      return {
        asset_id: asset.id,
        ticker: asset.ticker,
        name: asset.name,
        allocation_percent: asset.allocation,
        initial_simulated_price: asset.price,
        current_simulated_price: asset.price * multiplier,
        initial_value: initialValue,
        current_value: initialValue * multiplier,
        category: asset.category,
        exposure: asset.exposure,
        why: asset.why,
        risks: asset.risks,
      };
    });
    const { data: thesisId, error: saveError } = await supabaseAdmin.rpc(
      "save_tracked_thesis_atomic",
      {
        owner_id: context.userId,
        session_id: data.credentials.id,
        payload: {
          email,
          name: profileName,
          title: title.slice(0, 120),
          belief: data.belief,
          interpretation: data.interpretation,
          currentValue,
          assets: assetRows,
          snapshots: generated.snapshots,
        } as unknown as Json,
      },
    );
    if (saveError || !thesisId) {
      console.error("Thesis persistence failed", { code: saveError?.code });
      if (saveError?.message.includes("Start a new demo"))
        throw new Error("This demo was already saved. Use Start over to save a different thesis.");
      throw new Error("Your thesis could not be saved. Please try again.");
    }
    return { thesisId };
  });

export const listMyTheses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("theses")
      .select(selection)
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error("Theses could not be loaded");
    return ((data ?? []) as unknown as ThesisRow[]).map(mapThesis);
  });

export const getMyThesis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().max(100) }).parse(input))
  .handler(async ({ data, context }) => {
    if (!z.string().uuid().safeParse(data.id).success) return null;
    const { data: row, error } = await context.supabase
      .from("theses")
      .select(selection)
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error("Thesis could not be loaded");
    if (!row) return null;
    const thesis = mapThesis(row as unknown as ThesisRow);
    if (!thesis.assets.length || thesis.snapshots.length !== 31)
      throw new Error(
        "This thesis was not fully saved. Return to the original demo and retry saving.",
      );
    return thesis;
  });
