import { PrivyClient } from '@privy-io/node';
import { Redis } from 'ioredis';
import { noInterpreterYet, type ConvictionInterpreter } from './ai/interpreter.js';
import { openAIInterpreter } from './ai/openai.js';
import { PrivyWalletResolver, type WalletResolver } from './auth/privy.js';
import { skipBotCheck, TurnstileBotCheck, type BotCheck } from './auth/turnstile.js';
import type { Config } from './config.js';
import { pgDb, type Db } from './db/index.js';
import { PgInterpretationStore, type InterpretationStore } from './interpretations.js';
import { noPlansYet, type PlanLookup } from './plans.js';
import { RedisQuotaStore, type QuotaStore } from './quota.js';

// Everything routes use to reach the outside world. Tests pass fakes; index.ts passes the real ones.
export interface Deps {
  config: Config;
  quota: QuotaStore;
  wallets: WalletResolver;
  plans: PlanLookup;
  botCheck: BotCheck;
  interpreter: ConvictionInterpreter;
  interpretations: InterpretationStore;
  redis?: Redis;
  close?: () => Promise<void>;
}

declare module 'fastify' {
  interface FastifyInstance {
    deps: Deps;
  }
}

export function createDeps(config: Config): Deps & { db: Db } {
  const redis = new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 5_000,
    retryStrategy: (attempt) => Math.min(attempt * 500, 5_000),
  });

  const privy = new PrivyClient({
    appId: config.PRIVY_APP_ID,
    appSecret: config.PRIVY_APP_SECRET,
    // Verifies tokens locally when set; otherwise the SDK fetches Privy's public keys.
    ...(config.PRIVY_VERIFICATION_KEY && { jwtVerificationKey: config.PRIVY_VERIFICATION_KEY }),
  });

  const db = pgDb(config.DATABASE_URL);

  return {
    config,
    quota: new RedisQuotaStore(redis),
    wallets: new PrivyWalletResolver(privy, redis),
    plans: noPlansYet,
    botCheck: config.TURNSTILE_SECRET_KEY ? new TurnstileBotCheck(config.TURNSTILE_SECRET_KEY) : skipBotCheck,
    // Without a key (allowed outside production), free-text interpretations answer 503 AI_UNAVAILABLE.
    interpreter: config.AI_API_KEY ? openAIInterpreter(config.AI_API_KEY, config.AI_MODEL) : noInterpreterYet,
    interpretations: new PgInterpretationStore(db),
    db,
    redis,
    close: async () => {
      await Promise.all([redis.quit(), db.close()]);
    },
  };
}
