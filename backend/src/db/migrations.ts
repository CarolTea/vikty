import type { Db } from './index.js';

// Append only: a migration that already ran is never edited, a change is a new entry.
// Kept in TypeScript so it ships inside dist/ with no extra files in the Docker image.
export const migrations: { id: string; sql: string }[] = [
  {
    id: '001_interpretations',
    sql: `
      -- What the AI understood (or the curated version of a suggested thesis) and, later, the
      -- person's corrections. The conviction text itself is never stored.
      CREATE TABLE interpretations (
        id                  text PRIMARY KEY,
        -- Owner: the anonymous session (sha256 of its id) and, when signed in, the wallet.
        session_hash        text NOT NULL,
        wallet              text,
        source              text NOT NULL CHECK (source IN ('free_text', 'suggested')),
        curated             boolean NOT NULL,
        suggested_thesis_id text,
        summary             text NOT NULL,
        exposures           jsonb NOT NULL,
        exclusions          jsonb NOT NULL,
        restrictions        jsonb NOT NULL,
        ambiguities         jsonb NOT NULL,
        representation      text NOT NULL CHECK (representation IN ('sufficient', 'partial', 'insufficient')),
        limitations         jsonb NOT NULL,
        status              text NOT NULL CHECK (status IN ('needs_clarification', 'ready')),
        created_at          timestamptz NOT NULL DEFAULT now(),
        updated_at          timestamptz NOT NULL DEFAULT now()
      );
    `,
  },
];

// Runs at startup, before the server listens. Each migration and its bookkeeping row go in one
// multi-statement query, which Postgres runs as a single implicit transaction: it applies fully or
// not at all. (No explicit BEGIN/COMMIT: after an error it would leave a pooled connection stuck in
// an aborted transaction.) Assumes one instance starting at a time (true for the MVP).
export async function migrate(db: Db): Promise<string[]> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id         text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  const rows = await db.query<{ id: string }>('SELECT id FROM schema_migrations');
  const applied = new Set(rows.map((r) => r.id));

  const ran: string[] = [];
  for (const { id, sql } of migrations) {
    if (applied.has(id)) continue;
    // `id` comes from the list above, never from input.
    await db.exec(`${sql}\nINSERT INTO schema_migrations (id) VALUES ('${id}');`);
    ran.push(id);
  }
  return ran;
}
