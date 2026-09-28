import { PrivyClient } from '@privy-io/node';
import { Redis } from 'ioredis';
import { PrivyWalletResolver, type WalletResolver } from './auth/privy.js';
import type { Config } from './config.js';
import { noPlansYet, type PlanLookup } from './plans.js';
import { RedisQuotaStore, type QuotaStore } from './quota.js';

// Everything routes use to reach the outside world. Tests pass fakes; index.ts passes the real ones.
export interface Deps {
  config: Config;
  quota: QuotaStore;
  wallets: WalletResolver;
  plans: PlanLookup;
  redis?: Redis;
  close?: () => Promise<void>;
}

declare module 'fastify' {
  interface FastifyInstance {
    deps: Deps;
  }
}

export function createDeps(config: Config): Deps {
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

  return {
    config,
    quota: new RedisQuotaStore(redis),
    wallets: new PrivyWalletResolver(privy, redis),
    plans: noPlansYet,
    redis,
    close: async () => {
      await redis.quit();
    },
  };
}
