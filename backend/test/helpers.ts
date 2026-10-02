import { PGlite } from '@electric-sql/pglite';
import type { AiInterpretation, ConvictionInterpreter } from '../src/ai/interpreter.js';
import type { BotCheck } from '../src/auth/turnstile.js';
import { buildApp } from '../src/app.js';
import { loadConfig, type Config } from '../src/config.js';
import type { Db } from '../src/db/index.js';
import type { Deps } from '../src/deps.js';
import { ApiError } from '../src/errors.js';
import type { InterpretationRecord, InterpretationStore } from '../src/interpretations.js';
import { noPlansYet } from '../src/plans.js';
import type { QuotaStore } from '../src/quota.js';

export const WALLET = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
export const VALID_TOKEN = 'valid.token.value';
export const HUMAN_TOKEN = 'turnstile-ok';

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

  async reserveAnonymous(sessionId: string) {
    return bump(this.anon, sessionId, 1);
  }

  async releaseAnonymous(sessionId: string) {
    bump(this.anon, sessionId, -1);
  }

  async reserveWallet(address: string, day: string) {
    return bump(this.wallet, `${address}:${day}`, 1);
  }

  async releaseWallet(address: string, day: string) {
    bump(this.wallet, `${address}:${day}`, -1);
  }
}

function bump(map: Map<string, number>, key: string, by: number) {
  const value = (map.get(key) ?? 0) + by;
  map.set(key, value);
  return value;
}

// Passes only HUMAN_TOKEN; records every call.
export class FakeBotCheck implements BotCheck {
  readonly calls: { token: string; remoteIp: string }[] = [];

  async verify(token: string, remoteIp: string) {
    this.calls.push({ token, remoteIp });
    return token === HUMAN_TOKEN;
  }
}

export const AI_ANSWER: AiInterpretation = {
  summary: 'Growing demand for physical AI infrastructure.',
  exposures: ['AI semiconductors', 'Data centers'],
  exclusions: ["Don't depend on a single company"],
  restrictions: [],
  ambiguities: [
    { question: 'Should energy for data centers be part of the thesis?', material: true, options: ['Yes, include it', 'No, compute only'] },
  ],
  representation: 'sufficient',
  limitations: [],
};

// Answers `answer` (AI_ANSWER by default), or throws it when it is an Error; records the input.
export class FakeInterpreter implements ConvictionInterpreter {
  readonly calls: string[] = [];
  answer: unknown = AI_ANSWER;

  async interpret(conviction: string) {
    this.calls.push(conviction);
    if (this.answer instanceof Error) throw this.answer;
    return this.answer;
  }
}

export class MemoryInterpretationStore implements InterpretationStore {
  readonly records: InterpretationRecord[] = [];
  fail = false;

  async create(record: InterpretationRecord) {
    if (this.fail) throw new Error('database down');
    this.records.push(record);
  }
}

// Real Postgres (PGlite, in memory) behind the app's Db interface.
export async function testDb(): Promise<Db> {
  const pg = await PGlite.create();
  return {
    async query<R extends object>(sql: string, params: unknown[] = []) {
      return (await pg.query<R>(sql, params)).rows;
    },
    async exec(sql) {
      await pg.exec(sql);
    },
    close: () => pg.close(),
  };
}

type TestDeps = Deps & {
  quota: MemoryQuotaStore;
  botCheck: FakeBotCheck;
  interpreter: FakeInterpreter;
  interpretations: MemoryInterpretationStore;
};

export function testDeps(overrides: Partial<Deps> = {}): TestDeps {
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
    botCheck: new FakeBotCheck(),
    interpreter: new FakeInterpreter(),
    interpretations: new MemoryInterpretationStore(),
    ...overrides,
  } as TestDeps;
}

export function testApp(overrides: Partial<Deps> = {}) {
  return buildApp(testDeps(overrides));
}
