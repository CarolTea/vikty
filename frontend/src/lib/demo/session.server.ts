import { createHash, timingSafeEqual } from "node:crypto";
import type { DemoSessionCredentials } from "./types";
import { stateSchema } from "./schemas";
export const hashSecret = (secret: string) => createHash("sha256").update(secret).digest("hex");
const secretsMatch = (provided: string, stored: string) => {
  const a = Buffer.from(hashSecret(provided), "hex");
  const b = Buffer.from(stored, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
};

export async function verifiedSession(credentials: DemoSessionCredentials) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("demo_sessions")
    .select("id, secret_hash, state")
    .eq("id", credentials.id)
    .maybeSingle();
  if (error || !data || !secretsMatch(credentials.secret, data.secret_hash)) return null;
  const parsed = stateSchema.safeParse(data.state);
  return parsed.success ? { supabaseAdmin, state: parsed.data } : null;
}
