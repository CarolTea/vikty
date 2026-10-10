import { it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadEnv } from "vite";

it("includes public Supabase configuration in a clean production checkout without local .env", () => {
  const directory = mkdtempSync(join(tmpdir(), "victy-public-config-"));
  const source = readFileSync(new URL("../.env.production", import.meta.url), "utf8");
  try {
    writeFileSync(join(directory, ".env.production"), source);
    const env = loadEnv("production", directory, "VITE_");
    assert.ok(env.VITE_SUPABASE_URL, "Production requires VITE_SUPABASE_URL");
    assert.equal(new URL(env.VITE_SUPABASE_URL).protocol, "https:");
    assert.ok(
      env.VITE_SUPABASE_PUBLISHABLE_KEY?.startsWith("sb_publishable_"),
      "Only a publishable key is allowed in the browser",
    );
    const keys = source
      .split("\n")
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => line.split("=")[0]);
    assert.deepEqual(
      keys.sort(),
      [
        "SUPABASE_PROJECT_ID",
        "SUPABASE_PUBLISHABLE_KEY",
        "SUPABASE_URL",
        "VITE_SUPABASE_PROJECT_ID",
        "VITE_SUPABASE_PUBLISHABLE_KEY",
        "VITE_SUPABASE_URL",
      ].sort(),
    );
    assert.ok(!source.includes("sb_secret_"));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
