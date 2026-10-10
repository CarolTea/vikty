import { DEFAULT_AI_MODEL } from './ai/openai.js';
import { z } from 'zod';
import { parseUsdc } from './money.js';

const secret = z.string().default('');
const bps = z.coerce.number().int().min(0).max(10_000);
const usdc = z.string().refine((v) => parseUsdc(v) !== null, 'must be a decimal USDC amount, like 500 or 12.50');

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
    // Per call, with one retry. Slower models (free ones on OpenRouter) need more.
    AI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120_000).default(20_000),

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
    // Local testing only: approves every registry instrument with a fake mint, so the journey can be
    // walked end to end before spike S1 approves real ones. Refused in production.
    DEV_APPROVE_DEMO_INSTRUMENTS: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
    // "Ask VicTy" about a proposal: question length and questions per proposal.
    EXPLANATION_MAX_CHARS: z.coerce.number().int().positive().default(300),
    EXPLANATIONS_PER_PROPOSAL: z.coerce.number().int().nonnegative().default(5),
    // Composition policy (PRD §9.4). Weights in basis points; budget in USDC, as decimal strings.
    MAX_WEIGHT_BPS: bps.default(4000),
    MIN_WEIGHT_BPS: bps.default(500),
    MIN_BUDGET_USDC: usdc.default('1'),
    MAX_BUDGET_USDC: usdc.default('10000'),
  })
  .superRefine((env, ctx) => {
    if (env.MIN_WEIGHT_BPS > env.MAX_WEIGHT_BPS) {
      ctx.addIssue({ code: 'custom', path: ['MIN_WEIGHT_BPS'], message: 'must not exceed MAX_WEIGHT_BPS' });
    }
    if (parseUsdc(env.MIN_BUDGET_USDC)! > parseUsdc(env.MAX_BUDGET_USDC)!) {
      ctx.addIssue({ code: 'custom', path: ['MIN_BUDGET_USDC'], message: 'must not exceed MAX_BUDGET_USDC' });
    }

    if (env.NODE_ENV === 'production' && env.DEV_APPROVE_DEMO_INSTRUMENTS) {
      ctx.addIssue({ code: 'custom', path: ['DEV_APPROVE_DEMO_INSTRUMENTS'], message: 'never in production' });
    }

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
