import { DEFAULT_AI_MODEL } from './ai/openai.js';
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

    // OpenAI. Without a key, free-text interpretations answer 503 AI_UNAVAILABLE.
    AI_API_KEY: secret,
    AI_MODEL: z.string().min(1).default(DEFAULT_AI_MODEL),

    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),

    PRIVY_APP_ID: secret,
    PRIVY_APP_SECRET: secret,
    PRIVY_VERIFICATION_KEY: secret,
    SESSION_SECRET: z.union([z.literal(''), z.string().min(32)]).default(''),
    TURNSTILE_SECRET_KEY: secret,

    // Product limits; the API contract treats these as configuration, not constants.
    CONVICTION_MAX_CHARS: z.coerce.number().int().positive().default(600),
    WALLET_DAILY_INTERPRETATIONS: z.coerce.number().int().nonnegative().default(20),
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
