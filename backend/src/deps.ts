import { PrivyClient } from '@privy-io/node';
import { Redis } from 'ioredis';
import { noComposerYet, type ProposalComposer } from './ai/composer.js';
import { noExplainerYet, type ProposalExplainer } from './ai/explainer.js';
import { noInterpreterYet, type ConvictionInterpreter } from './ai/interpreter.js';
import { OpenAIComposer, OpenAIExplainer, OpenAIInterpreter, openAIClient } from './ai/openai.js';
import { PrivyWalletResolver, type WalletResolver } from './auth/privy.js';
import { noAvailabilityYet, type AvailabilityLookup } from './availability.js';
import { devCatalog, registryCatalog, type Catalog } from './catalog/instruments.js';
import { skipBotCheck, TurnstileBotCheck, type BotCheck } from './auth/turnstile.js';
import type { Config } from './config.js';
import { pgDb, type Db } from './db/index.js';
import { PgInterpretationStore, type InterpretationStore } from './interpretations.js';
import { PgPlanStore, type PlanStore } from './plans.js';
import { PgProposalStore, type ProposalStore } from './proposals.js';
import { RedisQuotaStore, type QuotaStore } from './quota.js';

// Everything routes use to reach the outside world. Tests pass fakes; index.ts passes the real ones.
export interface Deps {
  config: Config;
  quota: QuotaStore;
  wallets: WalletResolver;
  plans: PlanStore;
  botCheck: BotCheck;
  interpreter: ConvictionInterpreter;
  interpretations: InterpretationStore;
  composer: ProposalComposer;
  explainer: ProposalExplainer;
  proposals: ProposalStore;
  catalog: Catalog;
  availability: AvailabilityLookup;
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
  const openai = config.AI_API_KEY ? openAIClient(config.AI_API_KEY, config.AI_TIMEOUT_MS) : null;

  return {
    config,
    quota: new RedisQuotaStore(redis),
    wallets: new PrivyWalletResolver(privy, redis),
    plans: new PgPlanStore(db),
    botCheck: config.TURNSTILE_SECRET_KEY ? new TurnstileBotCheck(config.TURNSTILE_SECRET_KEY) : skipBotCheck,
    // Without a key (allowed outside production), free-text interpretations answer 503 AI_UNAVAILABLE.
    interpreter: openai ? new OpenAIInterpreter(openai, config.AI_MODEL) : noInterpreterYet,
    interpretations: new PgInterpretationStore(db),
    composer: openai ? new OpenAIComposer(openai, config.AI_MODEL) : noComposerYet,
    explainer: openai ? new OpenAIExplainer(openai, config.AI_MODEL) : noExplainerYet,
    proposals: new PgProposalStore(db),
    catalog: config.DEV_APPROVE_DEMO_INSTRUMENTS ? devCatalog() : registryCatalog,
    // No Jupiter adapter yet: every instrument is `unknown` and validations are inconclusive.
    availability: noAvailabilityYet,
    db,
    redis,
    close: async () => {
      await Promise.all([redis.quit(), db.close()]);
    },
  };
}
