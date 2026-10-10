import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const signupSchema = z.object({
  name: z.string().trim().min(2).max(100),
  whatsapp: z.string().trim().min(8).max(24),
  email: z.string().trim().email().max(254),
  website: z.string().max(0),
});

export type EarlyAccessResult =
  | { ok: true }
  | { ok: false; reason: "duplicate" | "invalid" | "unavailable" };

export const joinEarlyAccess = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => signupSchema.parse(input))
  .handler(async ({ data }): Promise<EarlyAccessResult> => {
    if (data.website) return { ok: false, reason: "invalid" };

    const digits = data.whatsapp.replace(/\D/g, "");
    const whatsapp = `+${digits}`;
    if (!/^\+[1-9][0-9]{7,14}$/.test(whatsapp)) {
      return { ok: false, reason: "invalid" };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("early_access_signups").insert({
      name: data.name.trim().replace(/\s+/g, " "),
      whatsapp,
      email: data.email.trim().toLowerCase(),
    });

    if (!error) return { ok: true };
    if (error.code === "23505") return { ok: false, reason: "duplicate" };

    console.error("Early access signup failed", { code: error.code });
    return { ok: false, reason: "unavailable" };
  });