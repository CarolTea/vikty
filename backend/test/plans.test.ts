import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildApp } from '../src/app.js';
import { SESSION_COOKIE, sessionHash } from '../src/auth/session.js';
import { migrate } from '../src/db/migrations.js';
import { PgInterpretationStore, type InterpretationRecord } from '../src/interpretations.js';
import { PgPlanStore, type PlanRecord } from '../src/plans.js';
import { PgProposalStore } from '../src/proposals.js';
import { approvedForTest, testDb, testDeps, VALID_TOKEN, WALLET } from './helpers.js';

const auth = { authorization: `Bearer ${VALID_TOKEN}` };

// The draft the proposal comes with (AI_COMPOSITION): NVDA 35, AMD 25, VRT 25, USDC 15.
const DRAFT = [
  { instrumentId: 'ins_ondo_nvda', weightBps: 3500, state: 'active' },
  { instrumentId: 'ins_ondo_amd', weightBps: 2500, state: 'active' },
  { instrumentId: 'ins_ondo_vrt', weightBps: 2500, state: 'active' },
  { instrumentId: 'ins_usdc', weightBps: 1500, state: 'active' },
];

async function setup() {
  const deps = testDeps();
  const app = await buildApp(deps);
  const session = await app.inject({ method: 'GET', url: '/api/v1/session' });
  const cookie = session.cookies.find((c) => c.name === SESSION_COOKIE)!.value;
  const cookies = { [SESSION_COOKIE]: cookie };

  deps.interpretations.records.push({
    id: 'int_1',
    sessionHash: sessionHash(app.unsignCookie(cookie).value!),
    wallet: null,
    source: 'free_text',
    curated: false,
    suggestedThesisId: null,
    summary: 'Growing demand for physical AI infrastructure.',
    exposures: [
      { id: 'exp_1', label: 'AI semiconductors' },
      { id: 'exp_2', label: 'Data centers' },
    ],
    exclusions: [],
    restrictions: [],
    ambiguities: [],
    representation: 'sufficient',
    limitations: [],
    status: 'ready',
    version: 1,
  });
  // Built before connecting the wallet, like the real journey.
  const proposal = (await app.inject({ method: 'POST', url: '/api/v1/proposals', payload: { interpretationId: 'int_1', budgetUsdc: '500' }, cookies })).json();

  const call = (method: 'GET' | 'POST' | 'PUT' | 'PATCH', url: string, payload?: object, headers: Record<string, string> = auth) =>
    app.inject({ method, url: `/api/v1${url}`, ...(payload && { payload }), headers, cookies });
  const save = (items: object[] = DRAFT, budgetUsdc = '500') => call('POST', '/plans', { proposalId: proposal.id, budgetUsdc, items });

  return { deps, app, proposal, call, save };
}

const nvdaMint = approvedForTest('ins_ondo_nvda').mint!;
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

describe('POST /plans', () => {
  it('saves the draft as a plan of the wallet', async () => {
    const { deps, app, proposal, save } = await setup();
    const res = await save();

    assert.equal(res.statusCode, 201);
    const plan = res.json();
    assert.match(plan.id, /^plan_/);
    assert.equal(res.headers.location, `/api/v1/plans/${plan.id}`);
    assert.equal(plan.proposalId, proposal.id);
    assert.equal(plan.status, 'draft');
    assert.equal(plan.version, 1);
    assert.equal(plan.interpretationSummary, 'Growing demand for physical AI infrastructure.');
    assert.deepEqual(plan.trackedMints, []);
    assert.equal(plan.validation.valid, true);
    assert.deepEqual(
      plan.items.map((i: { plannedUsdc: string }) => i.plannedUsdc),
      ['175.00', '125.00', '125.00', '75.00'],
    );
    assert.ok(!('wallet' in plan));
    assert.equal(deps.plans.records[0]!.wallet, WALLET);
    await app.close();
  });

  it('keeps proposal items left out of the draft as rejected', async () => {
    const { app, save } = await setup();
    const res = await save([
      { instrumentId: 'ins_ondo_nvda', weightBps: 4000, state: 'active' },
      { instrumentId: 'ins_ondo_vrt', weightBps: 3500, state: 'active' },
      { instrumentId: 'ins_usdc', weightBps: 2500, state: 'active' },
    ]);
    assert.equal(res.statusCode, 201);
    assert.deepEqual(
      res.json().items.map((i: { instrument: { id: string }; state: string }) => [i.instrument.id, i.state]),
      [
        ['ins_ondo_nvda', 'active'],
        ['ins_ondo_amd', 'rejected'],
        ['ins_ondo_vrt', 'active'],
        ['ins_usdc', 'active'],
      ],
    );
    await app.close();
  });

  it('refuses a draft that fails the validator, with the validation', async () => {
    const { deps, app, save } = await setup();
    const res = await save(DRAFT.map((i) => (i.instrumentId === 'ins_usdc' ? { ...i, weightBps: 500 } : i)));

    assert.equal(res.statusCode, 422);
    assert.equal(res.json().error.code, 'PLAN_INVALID');
    assert.equal(res.json().error.details.validation.valid, false);
    assert.equal(res.json().error.details.validation.issues[0].code, 'SUM_NOT_100');
    assert.equal(deps.plans.records.length, 0);
    await app.close();
  });

  it('needs a wallet, and a proposal of this session or wallet', async () => {
    const { app, call, proposal } = await setup();
    const anonymous = await call('POST', '/plans', { proposalId: proposal.id, budgetUsdc: '500', items: DRAFT }, {});
    assert.equal(anonymous.statusCode, 401);
    assert.equal(anonymous.json().error.code, 'UNAUTHENTICATED');

    const missing = await call('POST', '/plans', { proposalId: 'prop_nope', budgetUsdc: '500', items: DRAFT });
    assert.equal(missing.statusCode, 404);

    const elsewhere = await app.inject({
      method: 'POST',
      url: '/api/v1/plans',
      payload: { proposalId: proposal.id, budgetUsdc: '500', items: DRAFT },
      headers: auth,
    });
    assert.equal(elsewhere.statusCode, 404, 'another browser, and the proposal was never tied to the wallet');
    await app.close();
  });
});

describe('GET /plans and /plans/{id}', () => {
  it('lists the wallet plans, most recent first, and reads one', async () => {
    const { app, call, save } = await setup();
    const first = (await save()).json();
    const second = (await save(DRAFT, '900')).json();

    const list = await call('GET', '/plans');
    assert.equal(list.statusCode, 200);
    assert.deepEqual(
      list.json().items.map((p: { id: string }) => p.id),
      [second.id, first.id],
    );
    assert.deepEqual(Object.keys(list.json().items[0]).sort(), ['budgetUsdc', 'createdAt', 'id', 'interpretationSummary', 'status', 'updatedAt', 'version']);

    const one = await call('GET', `/plans/${first.id}`);
    assert.equal(one.statusCode, 200);
    assert.deepEqual(one.json(), first);
    await app.close();
  });

  it('needs a wallet and hides other wallets plans', async () => {
    const { deps, app, call, save } = await setup();
    const plan = (await save()).json();
    assert.equal((await call('GET', '/plans', undefined, {})).statusCode, 401);
    assert.equal((await call('GET', `/plans/${plan.id}`, undefined, {})).statusCode, 401);

    deps.plans.records[0]!.wallet = 'Other1111111111111111111111111111111111111';
    assert.equal((await call('GET', `/plans/${plan.id}`)).statusCode, 404);
    assert.deepEqual((await call('GET', '/plans')).json(), { items: [] });
    await app.close();
  });
});

describe('PUT /plans/{id}', () => {
  it('saves a new version of weights, rejections and budget', async () => {
    const { app, call, save } = await setup();
    const plan = (await save()).json();
    const res = await call('PUT', `/plans/${plan.id}`, {
      budgetUsdc: '1000',
      items: [
        { instrumentId: 'ins_ondo_nvda', weightBps: 4000, state: 'active' },
        { instrumentId: 'ins_ondo_amd', weightBps: 3000, state: 'active' },
        { instrumentId: 'ins_usdc', weightBps: 3000, state: 'active' },
      ],
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.json().version, 2);
    assert.equal(res.json().budgetUsdc, '1000');
    assert.deepEqual(
      res.json().items.map((i: { state: string; plannedUsdc: string }) => [i.state, i.plannedUsdc]),
      [
        ['active', '400.00'],
        ['active', '300.00'],
        ['rejected', '0.00'],
        ['active', '300.00'],
      ],
    );
    await app.close();
  });

  it('refuses an invalid version or an instrument from outside the plan, and keeps the old one', async () => {
    const { deps, app, call, save } = await setup();
    const plan = (await save()).json();
    for (const items of [
      DRAFT.map((i) => (i.instrumentId === 'ins_ondo_nvda' ? { ...i, weightBps: 4500 } : i)),
      [...DRAFT, { instrumentId: 'ins_ondo_ceg', weightBps: 0, state: 'rejected' }],
    ]) {
      const res = await call('PUT', `/plans/${plan.id}`, { budgetUsdc: '500', items });
      assert.equal(res.statusCode, 422);
      assert.equal(res.json().error.code, 'PLAN_INVALID');
    }
    assert.equal(deps.plans.records[0]!.version, 1);
    await app.close();
  });
});

describe('PATCH /plans/{id}', () => {
  it('activates with mints of active items and records the scope', async () => {
    const { deps, app, call, save } = await setup();
    const plan = (await save()).json();
    const res = await call('PATCH', `/plans/${plan.id}`, { status: 'active', trackedMints: [nvdaMint, USDC_MINT, USDC_MINT], confirmPreexistingBalances: true });

    assert.equal(res.statusCode, 200);
    assert.equal(res.json().status, 'active');
    assert.deepEqual(res.json().trackedMints, [nvdaMint, USDC_MINT]);
    assert.equal(res.json().version, 1, 'activation is not a new version');
    assert.equal(deps.plans.scopeChanges.length, 1);

    // Changing the scope later is another PATCH, also recorded.
    await call('PATCH', `/plans/${plan.id}`, { status: 'active', trackedMints: [USDC_MINT], confirmPreexistingBalances: false });
    assert.equal(deps.plans.scopeChanges.length, 2);

    const session = await call('GET', '/session');
    assert.equal(session.json().activePlanId, plan.id);
    await app.close();
  });

  it('refuses mints outside the plan active items', async () => {
    const { app, call, save } = await setup();
    const plan = (await save(DRAFT.map((i) => (i.instrumentId === 'ins_ondo_amd' ? { ...i, state: 'rejected', weightBps: 0 } : i.instrumentId === 'ins_ondo_nvda' ? { ...i, weightBps: 4000 } : i.instrumentId === 'ins_usdc' ? { ...i, weightBps: 3500 } : i)))).json();
    const amdMint = approvedForTest('ins_ondo_amd').mint!;
    for (const mints of [[amdMint], ['So11111111111111111111111111111111111111112']]) {
      const res = await call('PATCH', `/plans/${plan.id}`, { status: 'active', trackedMints: mints, confirmPreexistingBalances: true });
      assert.equal(res.statusCode, 400);
      assert.deepEqual(res.json().error.details, { fields: ['trackedMints'] });
    }
    await app.close();
  });

  it('never goes back to draft', async () => {
    const { app, call, save } = await setup();
    const plan = (await save()).json();
    const res = await call('PATCH', `/plans/${plan.id}`, { status: 'draft', trackedMints: [], confirmPreexistingBalances: false });
    assert.equal(res.statusCode, 400);
    await app.close();
  });

  it('refuses to activate a plan that no longer passes the validator', async () => {
    const { deps, app, call, save } = await setup();
    const plan = (await save()).json();
    // NVDA lost its approval after the plan was saved.
    const nvda = deps.catalog.instruments.get('ins_ondo_nvda')!;
    deps.catalog.instruments.set('ins_ondo_nvda', { ...nvda, status: 'restricted' });
    const res = await call('PATCH', `/plans/${plan.id}`, { status: 'active', trackedMints: [], confirmPreexistingBalances: true });

    assert.equal(res.statusCode, 422);
    assert.equal(res.json().error.code, 'PLAN_INVALID');
    assert.equal(deps.plans.records[0]!.status, 'draft');
    await app.close();
  });
});

describe('PgPlanStore', () => {
  const interpretation: InterpretationRecord = {
    id: 'int_1',
    sessionHash: 'a'.repeat(64),
    wallet: null,
    source: 'free_text',
    curated: false,
    suggestedThesisId: null,
    summary: 'AI infrastructure.',
    exposures: [],
    exclusions: [],
    restrictions: [],
    ambiguities: [],
    representation: 'sufficient',
    limitations: [],
    status: 'ready',
    version: 1,
  };
  const plan: PlanRecord = {
    id: 'plan_1',
    wallet: WALLET,
    proposalId: 'prop_1',
    interpretationSummary: 'AI infrastructure.',
    status: 'draft',
    version: 1,
    budgetUsdc: '500.00',
    items: [{ instrumentId: 'ins_usdc', exposureIds: [], weightBps: 10_000, rationale: 'Liquidity.', state: 'active' }],
    exposures: [],
    excludedInstrumentIds: [],
    trackedMints: [],
    confirmPreexistingBalances: false,
    createdAt: '2026-10-09T12:00:00.000Z',
    updatedAt: '2026-10-09T12:00:00.000Z',
  };

  async function store() {
    const db = await testDb();
    await migrate(db);
    await new PgInterpretationStore(db).create(interpretation);
    await new PgProposalStore(db).create({
      id: 'prop_1',
      interpretationId: 'int_1',
      interpretationVersion: 1,
      sessionHash: 'a'.repeat(64),
      wallet: null,
      curated: false,
      budgetUsdc: '500',
      items: [],
      exposures: [],
      excludedInstrumentIds: [],
      limitations: [],
    });
    return { db, plans: new PgPlanStore(db) };
  }

  it('stores, lists by wallet and finds the latest active plan', async () => {
    const { db, plans } = await store();
    await plans.create(plan);
    await plans.create({ ...plan, id: 'plan_2', updatedAt: '2026-10-09T13:00:00.000Z' });
    await plans.create({ ...plan, id: 'plan_x', wallet: 'Other', updatedAt: '2026-10-09T14:00:00.000Z' });

    assert.deepEqual(await plans.get('plan_1'), plan);
    assert.equal(await plans.get('plan_nope'), null);
    assert.deepEqual((await plans.listByWallet(WALLET)).map((p) => p.id), ['plan_2', 'plan_1']);
    assert.equal(await plans.activePlanId(WALLET), null);

    await plans.update({ ...plan, status: 'active', trackedMints: [USDC_MINT], updatedAt: '2026-10-09T15:00:00.000Z' }, 1, true);
    assert.equal(await plans.activePlanId(WALLET), 'plan_1');
    await db.close();
  });

  it('updates only on the expected version, and records scope changes with it', async () => {
    const { db, plans } = await store();
    await plans.create(plan);

    assert.equal(await plans.update({ ...plan, version: 2, budgetUsdc: '900' }, 1, false), true);
    assert.equal(await plans.update({ ...plan, version: 2, budgetUsdc: '1' }, 1, false), false, 'stale version');
    assert.equal((await plans.get('plan_1'))?.budgetUsdc, '900');
    assert.deepEqual(await db.query('SELECT plan_id FROM plan_scope_changes'), []);

    assert.equal(await plans.update({ ...plan, version: 2, status: 'active', trackedMints: [USDC_MINT], confirmPreexistingBalances: true }, 2, true), true);
    assert.equal(await plans.update({ ...plan, version: 2, trackedMints: [] }, 99, true), false);
    const changes = await db.query<{ plan_id: string; tracked_mints: string[]; confirm_preexisting_balances: boolean }>(
      'SELECT plan_id, tracked_mints, confirm_preexisting_balances FROM plan_scope_changes',
    );
    assert.deepEqual(changes, [{ plan_id: 'plan_1', tracked_mints: [USDC_MINT], confirm_preexisting_balances: true }], 'nothing recorded for the failed update');
    await db.close();
  });
});
