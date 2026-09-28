import { buildApp } from '../src/app.js';
import { loadConfig, type Config } from '../src/config.js';
import type { Deps } from '../src/deps.js';
import { ApiError } from '../src/errors.js';
import { noPlansYet } from '../src/plans.js';
import type { QuotaStore } from '../src/quota.js';

export const WALLET = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
export const VALID_TOKEN = 'valid.token.value';

export function testConfig(overrides: Record<string, string> = {}): Config {
  return loadConfig({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    WEB_ORIGIN: 'http://localhost:3000',
    SOLANA_RPC_URL: 'https://api.mainnet-beta.solana.com',
    DATABASE_URL: 'postgres://vikty:vikty@localhost:5432/vikty',
    REDIS_URL: 'redis://localhost:6379',
    SESSION_SECRET: 'test-secret-test-secret-test-secret-00',
    ...overrides,
  });
}

export class MemoryQuotaStore implements QuotaStore {
  readonly anon = new Map<string, number>();
  readonly wallet = new Map<string, number>();

  async anonymousUsed(sessionId: string) {
    return this.anon.get(sessionId) ?? 0;
  }

  async walletUsed(address: string, day: string) {
    return this.wallet.get(`${address}:${day}`) ?? 0;
  }
}

export function testDeps(overrides: Partial<Deps> = {}): Deps & { quota: MemoryQuotaStore } {
  return {
    config: testConfig(),
    quota: new MemoryQuotaStore(),
    wallets: {
      async resolve(token) {
        if (token === VALID_TOKEN) return WALLET;
        throw new ApiError(401, 'UNAUTHENTICATED', 'Your session has expired. Connect your wallet again.');
      },
    },
    plans: noPlansYet,
    ...overrides,
  } as Deps & { quota: MemoryQuotaStore };
}

export function testApp(overrides: Partial<Deps> = {}) {
  return buildApp(testDeps(overrides));
}
