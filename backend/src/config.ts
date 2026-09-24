import { z } from 'zod';

const secret = z.string().default('');

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3001),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    WEB_ORIGIN: z.string().url(),

    SOLANA_CLUSTER: z.string().default('mainnet-beta'),
    SOLANA_RPC_URL: z.string().url(),

    JUPITER_API_URL: z.string().url().default('https://api.jup.ag'),
    JUPITER_API_KEY: secret,

    AI_API_KEY: secret,

    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),

    PRIVY_APP_ID: secret,
    PRIVY_APP_SECRET: secret,
    SESSION_SECRET: secret,
    TURNSTILE_SECRET_KEY: secret,
  })
  .superRefine((env, ctx) => {
    // Empty secrets are fine locally; production must have every one of them.
    if (env.NODE_ENV !== 'production') return;
    const required = [
      'JUPITER_API_KEY',
      'AI_API_KEY',
      'PRIVY_APP_ID',
      'PRIVY_APP_SECRET',
      'SESSION_SECRET',
      'TURNSTILE_SECRET_KEY',
    ] as const;
    for (const key of required) {
      if (!env[key]) ctx.addIssue({ code: 'custom', path: [key], message: 'required in production' });
    }
  });

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    // Only variable names and reasons are printed, never values.
    const problems = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment:\n${problems}`);
  }
  return parsed.data;
}
