import pg from 'pg';

// The slice of Postgres the app uses. Production wraps a `pg` pool; tests wrap PGlite (real
// Postgres in WASM), so the same SQL runs in both.
export interface Db {
  // One statement, always parameterized ($1, $2…); never build SQL from strings.
  query<R extends object>(sql: string, params?: unknown[]): Promise<R[]>;
  // Several statements, no parameters. Used by migrations only.
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

export function pgDb(connectionString: string): Db {
  const pool = new pg.Pool({ connectionString, max: 10, connectionTimeoutMillis: 5_000 });
  return {
    async query<R extends object>(sql: string, params: unknown[] = []) {
      const result = await pool.query(sql, params);
      return result.rows as R[];
    },
    async exec(sql) {
      await pool.query(sql);
    },
    close: () => pool.end(),
  };
}
