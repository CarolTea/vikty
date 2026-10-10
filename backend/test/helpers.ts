import { PGlite } from '@electric-sql/pglite';
import type { AiComposition, CompositionInput, ProposalComposer } from '../src/ai/composer.js';
import type { AiExplanation, ExplanationInput, ProposalExplainer } from '../src/ai/explainer.js';
import type { AiInterpretation, ConvictionInterpreter } from '../src/ai/interpreter.js';
import type { BotCheck } from '../src/auth/turnstile.js';
import type { AvailabilityLookup } from '../src/availability.js';
import { findInstrument, type Catalog, type Instrument } from '../src/catalog/instruments.js';
import type { Availability } from '../src/composition.js';
import { buildApp } from '../src/app.js';
import { loadConfig, type Config } from '../src/config.js';
import type { Db } from '../src/db/index.js';
import type { Deps } from '../src/deps.js';
import { ApiError } from '../src/errors.js';
import type { InterpretationRecord, InterpretationStore } from '../src/interpretations.js';
import { noPlansYet } from '../src/plans.js';
import type { ProposalRecord, ProposalStore } from '../src/proposals.js';
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

  async get(id: string) {
    return this.records.find((r) => r.id === id) ?? null;
  }

  async update(record: InterpretationRecord) {
    const i = this.records.findIndex((r) => r.id === record.id && r.version === record.version - 1);
    if (i === -1) return false;
    this.records[i] = record;
    return true;
  }
}

// Registry entries approved for tests (the real registry approves only USDC so far), plus one that
// stays unavailable.
export const approvedForTest = (id: string): Instrument => ({
  ...findInstrument(id)!,
  status: 'approved',
  mint: `${id.replace(/[^A-Za-z1-9]/g, '').slice(0, 30)}1111111111111111`,
  decimals: 6,
});

export class FakeCatalog implements Catalog {
  readonly instruments = new Map<string, Instrument>(
    [
      approvedForTest('ins_ondo_nvda'),
      approvedForTest('ins_ondo_amd'),
      approvedForTest('ins_ondo_vrt'),
      approvedForTest('ins_ondo_ceg'),
      findInstrument('ins_usdc')!,
      findInstrument('ins_ondo_msft')!,
    ].map((i) => [i.id, i]),
  );
  approved = () => [...this.instruments.values()].filter((i) => i.status === 'approved');
  find = (id: string) => this.instruments.get(id);
}

export const AI_COMPOSITION: AiComposition = {
  items: [
    { instrumentId: 'ins_ondo_nvda', exposureIds: ['exp_1'], weightBps: 3500, rationale: 'Represents accelerated compute demand.' },
    { instrumentId: 'ins_ondo_amd', exposureIds: ['exp_1'], weightBps: 2500, rationale: 'A second chipmaker, so the thesis does not rest on one company.' },
    { instrumentId: 'ins_ondo_vrt', exposureIds: ['exp_2'], weightBps: 2500, rationale: 'Power and cooling equipment for data centers.' },
    { instrumentId: 'ins_usdc', exposureIds: [], weightBps: 1500, rationale: 'Liquidity kept aside.' },
  ],
  excludedInstrumentIds: [],
  limitations: [],
};

// Answers `answer` (AI_COMPOSITION by default), or throws it when it is an Error; records the input.
export class FakeComposer implements ProposalComposer {
  readonly calls: CompositionInput[] = [];
  answer: unknown = AI_COMPOSITION;

  async compose(input: CompositionInput) {
    this.calls.push(input);
    if (this.answer instanceof Error) throw this.answer;
    return this.answer;
  }
}

export class MemoryProposalStore implements ProposalStore {
  readonly records: ProposalRecord[] = [];

  async create(record: ProposalRecord) {
    this.records.push(record);
  }

  async get(id: string) {
    return this.records.find((r) => r.id === id) ?? null;
  }

  async latestFor(interpretationId: string, version: number) {
    return this.records.findLast((r) => r.interpretationId === interpretationId && r.interpretationVersion === version) ?? null;
  }
}

export const AI_EXPLANATION: AiExplanation = {
  explanation: 'NVDAon represents accelerated compute, the first exposure of your thesis, at 35%.',
  limitations: ['It is a tokenized product, not direct ownership of the shares.'],
};

// Answers `answer` (AI_EXPLANATION by default), or throws it when it is an Error; records the input.
export class FakeExplainer implements ProposalExplainer {
  readonly calls: ExplanationInput[] = [];
  answer: unknown = AI_EXPLANATION;

  async explain(input: ExplanationInput) {
    this.calls.push(input);
    if (this.answer instanceof Error) throw this.answer;
    return this.answer;
  }
}

// Every instrument buyable unless set otherwise.
export class FakeAvailability implements AvailabilityLookup {
  readonly states = new Map<string, Availability>();

  async check(ids: string[]) {
    const open: Availability = { buy: 'available', sell: 'available', checkedAt: '2026-10-09T12:00:00.000Z' };
    return new Map(ids.map((id) => [id, this.states.get(id) ?? open]));
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
  composer: FakeComposer;
  proposals: MemoryProposalStore;
  catalog: FakeCatalog;
  availability: FakeAvailability;
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
    composer: new FakeComposer(),
    proposals: new MemoryProposalStore(),
    catalog: new FakeCatalog(),
    availability: new FakeAvailability(),
    ...overrides,
  } as TestDeps;
}

export function testApp(overrides: Partial<Deps> = {}) {
  return buildApp(testDeps(overrides));
}
