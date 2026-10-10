import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildApp } from '../src/app.js';
import { SESSION_COOKIE, sessionHash } from '../src/auth/session.js';
import { noAvailabilityYet } from '../src/availability.js';
import type { InterpretationRecord } from '../src/interpretations.js';
import { AI_COMPOSITION, approvedForTest, testDeps, VALID_TOKEN, WALLET } from './helpers.js';

const URL = '/api/v1/proposals';
const NO_REPRESENTATION =
  "We couldn't find enough representation in the catalog for this thesis. We'd rather not substitute something similar.";

async function setup(overrides: Parameters<typeof testDeps>[0] = {}) {
  const deps = testDeps(overrides);
  const app = await buildApp(deps);
  const session = await app.inject({ method: 'GET', url: '/api/v1/session' });
  const cookie = session.cookies.find((c) => c.name === SESSION_COOKIE)!.value;
  const sessionId = app.unsignCookie(cookie).value!;
  const cookies = { [SESSION_COOKIE]: cookie };

  // An interpretation owned by this session, ready unless patched.
  const interpretation = (patch: Partial<InterpretationRecord> = {}) => {
    const record: InterpretationRecord = {
      id: `int_${deps.interpretations.records.length + 1}`,
      sessionHash: sessionHash(sessionId),
      wallet: null,
      source: 'free_text',
      curated: false,
      suggestedThesisId: null,
      summary: 'Growing demand for physical AI infrastructure.',
      exposures: [
        { id: 'exp_1', label: 'AI semiconductors' },
        { id: 'exp_2', label: 'Data centers' },
      ],
      exclusions: [{ id: 'exc_1', label: "Don't depend on a single company" }],
      restrictions: [],
      ambiguities: [],
      representation: 'sufficient',
      limitations: [],
      status: 'ready',
      version: 1,
      ...patch,
    };
    deps.interpretations.records.push(record);
    return record;
  };

  const create = (body: object, headers: Record<string, string> = {}) =>
    app.inject({ method: 'POST', url: URL, payload: body, headers, cookies });
  const read = (id: string, headers: Record<string, string> = {}) =>
    app.inject({ method: 'GET', url: `${URL}/${id}`, headers, cookies });
  const validate = (id: string, body: object) =>
    app.inject({ method: 'POST', url: `${URL}/${id}/validations`, payload: body, cookies });
  // Requests from a different browser: a fresh session.
  const stranger = (method: 'GET' | 'POST', url: string, payload?: object, headers: Record<string, string> = {}) =>
    app.inject({ method, url, ...(payload && { payload }), headers });

  return { deps, app, sessionId, interpretation, create, read, validate, stranger };
}

describe('POST /proposals', () => {
  it('composes with the AI among approved instruments and plans the budget', async () => {
    const { deps, app, interpretation, create } = await setup();
    const int = interpretation();
    const res = await create({ interpretationId: int.id, budgetUsdc: '500.00' });

    assert.equal(res.statusCode, 201);
    const body = res.json();
    assert.match(body.id, /^prop_/);
    assert.equal(res.headers.location, `${URL}/${body.id}`);
    assert.equal(res.headers['cache-control'], 'no-store');
    assert.equal(body.interpretationId, int.id);
    assert.equal(body.curated, false);
    assert.equal(body.budgetUsdc, '500.00');
    assert.deepEqual(body.limitations, []);
    assert.deepEqual(body.validation, {
      valid: true,
      conclusive: true,
      totalBps: 10_000,
      issues: [],
      policyVersion: 'v1;weight=500-4000;budget=1-10000',
    });

    const [nvda] = body.items;
    assert.deepEqual(nvda.instrument, {
      id: 'ins_ondo_nvda',
      symbol: 'NVDAon',
      name: 'NVIDIA (Ondo tokenized)',
      mint: approvedForTest('ins_ondo_nvda').mint,
      decimals: 6,
      kind: 'token',
      status: 'approved',
      exposureLabel: 'Accelerated compute',
      issuerName: 'Ondo Finance',
    });
    assert.deepEqual(nvda.exposureIds, ['exp_1']);
    assert.equal(nvda.weightBps, 3500);
    assert.equal(nvda.plannedUsdc, '175.00');
    assert.equal(nvda.rationale, AI_COMPOSITION.items[0]!.rationale);
    assert.ok(nvda.risks.includes('Market risk'));
    assert.equal(nvda.availability.buy, 'available');
    assert.equal(nvda.state, 'active');
    assert.deepEqual(
      body.items.map((i: { plannedUsdc: string }) => i.plannedUsdc),
      ['175.00', '125.00', '125.00', '75.00'],
    );

    // The AI saw the thesis and only approved instruments, never the unapproved one.
    const [input] = deps.composer.calls;
    assert.deepEqual(input!.thesis.exposures, int.exposures);
    assert.deepEqual(input!.thesis.exclusions, ["Don't depend on a single company"]);
    assert.deepEqual(input!.policy, { minWeightBps: 500, maxWeightBps: 4000 });
    assert.deepEqual(
      input!.candidates.map((c) => c.id).sort(),
      ['ins_ondo_amd', 'ins_ondo_ceg', 'ins_ondo_nvda', 'ins_ondo_vrt', 'ins_usdc'],
    );
    assert.equal(deps.proposals.records.length, 1);
    await app.close();
  });

  it('reuses the composition for a new budget, with no second AI call', async () => {
    const { deps, app, interpretation, create } = await setup();
    const int = interpretation();
    await create({ interpretationId: int.id, budgetUsdc: '500' });
    const res = await create({ interpretationId: int.id, budgetUsdc: '1000' });

    assert.equal(res.statusCode, 201);
    assert.equal(deps.composer.calls.length, 1);
    assert.equal(res.json().items[0].plannedUsdc, '350.00');
    assert.equal(deps.proposals.records.length, 2);
    await app.close();
  });

  it('answers 404 for an interpretation that does not exist or is not yours', async () => {
    const { app, interpretation, create, stranger } = await setup();
    assert.equal((await create({ interpretationId: 'int_nope', budgetUsdc: '500' })).statusCode, 404);

    const mine = interpretation();
    const res = await stranger('POST', URL, { interpretationId: mine.id, budgetUsdc: '500' });
    assert.equal(res.statusCode, 404);
    assert.equal(res.json().error.code, 'NOT_FOUND');

    const otherWallet = interpretation({ wallet: 'AnotherWa11et1111111111111111111111111111111' });
    const signedIn = await create({ interpretationId: otherWallet.id, budgetUsdc: '500' }, { authorization: `Bearer ${VALID_TOKEN}` });
    assert.equal(signedIn.statusCode, 404, 'another wallet, even from the same session');
    await app.close();
  });

  it("lets the wallet reach its interpretation from another browser", async () => {
    const { app, interpretation, stranger } = await setup();
    const int = interpretation({ wallet: WALLET });
    const res = await stranger('POST', URL, { interpretationId: int.id, budgetUsdc: '500' }, { authorization: `Bearer ${VALID_TOKEN}` });
    assert.equal(res.statusCode, 201);
    await app.close();
  });

  it('refuses an interpretation with open material questions', async () => {
    const { deps, app, interpretation, create } = await setup();
    const int = interpretation({
      status: 'needs_clarification',
      ambiguities: [
        { id: 'amb_1', question: 'Energy too?', material: true, options: [], answer: null },
        { id: 'amb_2', question: 'Horizon?', material: false, options: [], answer: null },
      ],
    });
    const res = await create({ interpretationId: int.id, budgetUsdc: '500' });

    assert.equal(res.statusCode, 422);
    assert.equal(res.json().error.code, 'INTERPRETATION_NOT_READY');
    assert.deepEqual(res.json().error.details, { ambiguityIds: ['amb_1'] });
    assert.equal(deps.composer.calls.length, 0);
    await app.close();
  });

  it('answers an insufficient interpretation with no items and no AI call', async () => {
    const { deps, app, interpretation, create } = await setup();
    const int = interpretation({ representation: 'insufficient', limitations: ['No direct exposure to private labs.'] });
    const res = await create({ interpretationId: int.id, budgetUsdc: '500' });

    assert.equal(res.statusCode, 201);
    assert.deepEqual(res.json().items, []);
    assert.deepEqual(res.json().limitations, ['No direct exposure to private labs.', NO_REPRESENTATION]);
    assert.equal(res.json().validation.valid, false);
    assert.equal(deps.composer.calls.length, 0);
    await app.close();
  });

  it('answers with no items when the catalog approves nothing but cash', async () => {
    const { deps, app, interpretation, create } = await setup();
    for (const [id, i] of deps.catalog.instruments) if (i.kind !== 'cash') deps.catalog.instruments.set(id, { ...i, status: 'unavailable' });
    const res = await create({ interpretationId: interpretation().id, budgetUsdc: '500' });

    assert.equal(res.statusCode, 201);
    assert.deepEqual(res.json().items, []);
    assert.equal(deps.composer.calls.length, 0);
    await app.close();
  });

  it('uses the curation for a suggested thesis, never the AI', async () => {
    const { deps, app, interpretation, create } = await setup();
    const int = interpretation({ source: 'suggested', curated: true, suggestedThesisId: 'th_ai_infra' });
    const res = await create({ interpretationId: int.id, budgetUsdc: '500' });

    assert.equal(res.statusCode, 201);
    assert.equal(res.json().curated, true);
    // th_ai_infra has no curated composition until its instruments are approved.
    assert.deepEqual(res.json().items, []);
    assert.deepEqual(res.json().limitations, [NO_REPRESENTATION]);
    assert.equal(deps.composer.calls.length, 0);
    await app.close();
  });

  it('accepts unassigned weight when a limitation explains it, and reports it', async () => {
    const { deps, app, interpretation, create } = await setup();
    deps.composer.answer = {
      ...AI_COMPOSITION,
      items: AI_COMPOSITION.items.slice(0, 3),
      limitations: ['No approved instrument for data center power.'],
    };
    const res = await create({ interpretationId: interpretation().id, budgetUsdc: '500' });

    assert.equal(res.statusCode, 201);
    assert.deepEqual(res.json().limitations, ['No approved instrument for data center power.']);
    assert.equal(res.json().validation.totalBps, 8500);
    assert.deepEqual(res.json().validation.issues.map((i: { code: string }) => i.code), ['SUM_NOT_100']);
    await app.close();
  });

  it('treats an AI failure, or an answer that breaks the rules, as AI_UNAVAILABLE and stores nothing', async () => {
    const { deps, app, interpretation, create } = await setup();
    const int = interpretation();
    const item = AI_COMPOSITION.items[0]!;
    const rest = AI_COMPOSITION.items.slice(1);
    const bad: [string, unknown][] = [
      ['provider error', new Error('timeout')],
      ['not an object', 'nope'],
      ['unknown key', { ...AI_COMPOSITION, tickers: [] }],
      ['instrument not offered', { ...AI_COMPOSITION, items: [{ ...item, instrumentId: 'ins_ondo_msft' }, ...rest] }],
      ['external mint', { ...AI_COMPOSITION, items: [{ ...item, instrumentId: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' }, ...rest] }],
      ['duplicate', { ...AI_COMPOSITION, items: [item, item, ...rest.slice(1)] }],
      ['unknown exposure', { ...AI_COMPOSITION, items: [{ ...item, exposureIds: ['exp_9'] }, ...rest] }],
      ['excluded used', { ...AI_COMPOSITION, excludedInstrumentIds: ['ins_ondo_nvda'] }],
      ['weight above max', { ...AI_COMPOSITION, items: [{ ...item, weightBps: 4500 }, ...rest], limitations: ['x'] }],
      ['weights above 100%', { ...AI_COMPOSITION, items: [...AI_COMPOSITION.items, { ...item, instrumentId: 'ins_ondo_ceg' }] }],
      ['unexplained shortfall', { ...AI_COMPOSITION, items: rest }],
      ['link in rationale', { ...AI_COMPOSITION, items: [{ ...item, rationale: 'See https://example.com.' }, ...rest] }],
      ['return promise', { ...AI_COMPOSITION, limitations: ['A guaranteed winner.'], items: rest }],
    ];
    for (const [name, answer] of bad) {
      deps.composer.answer = answer;
      const res = await create({ interpretationId: int.id, budgetUsdc: '500' });
      assert.equal(res.statusCode, 503, name);
      assert.equal(res.json().error.code, 'AI_UNAVAILABLE', name);
    }
    assert.equal(deps.proposals.records.length, 0);
    await app.close();
  });

  it('creates the proposal with a budget outside the policy and reports it', async () => {
    const { app, interpretation, create } = await setup();
    const res = await create({ interpretationId: interpretation().id, budgetUsdc: '20000' });

    assert.equal(res.statusCode, 201);
    assert.deepEqual(res.json().validation.issues.map((i: { code: string }) => i.code), ['BUDGET_INVALID']);
    assert.ok(res.json().items.every((i: { plannedUsdc: string }) => i.plannedUsdc === '0.00'));
    await app.close();
  });

  it('rejects a body outside the schema', async () => {
    const { app, interpretation, create } = await setup();
    const id = interpretation().id;
    for (const [body, field] of [
      [{ interpretationId: id, budgetUsdc: 500 }, 'budgetUsdc'],
      [{ interpretationId: id, budgetUsdc: '5e2' }, 'budgetUsdc'],
      [{ budgetUsdc: '500' }, 'interpretationId'],
    ] as const) {
      const res = await create(body);
      assert.equal(res.statusCode, 400, JSON.stringify(body));
      assert.deepEqual(res.json().error.details, { fields: [field] });
    }
    await app.close();
  });

  it('is inconclusive while availability is unknown', async () => {
    const { app, interpretation, create } = await setup({ availability: noAvailabilityYet as never });
    const res = await create({ interpretationId: interpretation().id, budgetUsdc: '500' });

    assert.equal(res.json().validation.valid, true);
    assert.equal(res.json().validation.conclusive, false);
    assert.deepEqual(res.json().items[0].availability, { buy: 'unknown', sell: 'unknown', checkedAt: null });
    await app.close();
  });

  it('warns about an instrument with no buy route', async () => {
    const { deps, app, interpretation, create } = await setup();
    deps.availability.states.set('ins_ondo_vrt', { buy: 'no_route', sell: 'available', checkedAt: '2026-10-09T12:00:00.000Z' });
    const res = await create({ interpretationId: interpretation().id, budgetUsdc: '500' });

    assert.equal(res.json().validation.valid, true);
    assert.deepEqual(res.json().validation.issues.map((i: { code: string; instrumentId: string }) => `${i.code}:${i.instrumentId}`), [
      'NO_ROUTE:ins_ondo_vrt',
    ]);
    await app.close();
  });
});

describe('GET /proposals/{id}', () => {
  it('serves the proposal to its owner and 404 to anyone else', async () => {
    const { app, interpretation, create, read, stranger } = await setup();
    const created = (await create({ interpretationId: interpretation().id, budgetUsdc: '500' })).json();

    const res = await read(created.id);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), created);

    assert.equal((await read('prop_nope')).statusCode, 404);
    assert.equal((await stranger('GET', `${URL}/${created.id}`)).statusCode, 404);
    await app.close();
  });
});

describe('POST /proposals/{id}/validations', () => {
  async function withProposal() {
    const s = await setup();
    const proposal = (await s.create({ interpretationId: s.interpretation().id, budgetUsdc: '500' })).json();
    return { ...s, proposal };
  }
  const codes = (body: { validation: { issues: { code: string; instrumentId: string | null }[] } }) =>
    body.validation.issues.map((i) => `${i.code}:${i.instrumentId}`);

  it('validates an edited draft and recalculates the planned amounts', async () => {
    const { app, proposal, validate } = await withProposal();
    const res = await validate(proposal.id, {
      budgetUsdc: '1000',
      items: [
        { instrumentId: 'ins_ondo_nvda', weightBps: 4000, state: 'active' },
        { instrumentId: 'ins_ondo_amd', weightBps: 2500, state: 'rejected' },
        { instrumentId: 'ins_ondo_vrt', weightBps: 3000, state: 'active' },
        { instrumentId: 'ins_usdc', weightBps: 3000, state: 'active' },
      ],
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.validation.valid, true);
    assert.equal(body.validation.totalBps, 10_000);
    assert.deepEqual(
      body.items.map((i: { instrument: { id: string }; weightBps: number; state: string; plannedUsdc: string }) => [
        i.instrument.id,
        i.weightBps,
        i.state,
        i.plannedUsdc,
      ]),
      [
        ['ins_ondo_nvda', 4000, 'active', '400.00'],
        ['ins_ondo_amd', 2500, 'rejected', '0.00'],
        ['ins_ondo_vrt', 3000, 'active', '300.00'],
        ['ins_usdc', 3000, 'active', '300.00'],
      ],
    );
    await app.close();
  });

  it('reports problems without fixing them, and never redistributes', async () => {
    const { app, proposal, validate } = await withProposal();
    const res = await validate(proposal.id, {
      budgetUsdc: '500',
      items: [
        { instrumentId: 'ins_ondo_nvda', weightBps: 4500, state: 'active' },
        { instrumentId: 'ins_ondo_amd', weightBps: 2500, state: 'active' },
        // ins_ondo_vrt left out → rejected; ins_usdc left out → rejected
      ],
    });

    const body = res.json();
    assert.equal(body.validation.valid, false);
    assert.deepEqual(codes(body), ['WEIGHT_ABOVE_MAX:ins_ondo_nvda', 'SUM_NOT_100:null', 'PARTIAL_REPRESENTATION:null']);
    assert.deepEqual(
      body.items.map((i: { state: string }) => i.state),
      ['active', 'active', 'rejected', 'rejected'],
    );
    await app.close();
  });

  it('reports an instrument from outside the proposal and does not serve it', async () => {
    const { app, proposal, validate } = await withProposal();
    const items = proposal.items.map((i: { instrument: { id: string }; weightBps: number }) => ({
      instrumentId: i.instrument.id,
      weightBps: i.weightBps,
      state: 'active',
    }));
    const res = await validate(proposal.id, { budgetUsdc: '500', items: [...items, { instrumentId: 'ins_ondo_ceg', weightBps: 0, state: 'active' }] });

    assert.ok(codes(res.json()).includes('INCOMPATIBLE_SUBSTITUTION:ins_ondo_ceg'));
    assert.equal(res.json().items.length, 4);
    await app.close();
  });

  it('rejects duplicates and bodies outside the schema', async () => {
    const { app, proposal, validate } = await withProposal();
    const nvda = { instrumentId: 'ins_ondo_nvda', weightBps: 3500, state: 'active' };
    const dup = await validate(proposal.id, { budgetUsdc: '500', items: [nvda, nvda] });
    assert.equal(dup.statusCode, 400);
    assert.deepEqual(dup.json().error.details, { fields: ['items'] });

    for (const body of [
      { budgetUsdc: '500', items: [{ ...nvda, weightBps: 10_001 }] },
      { budgetUsdc: '500', items: [{ ...nvda, weightBps: 35.5 }] },
      { budgetUsdc: '500', items: [{ ...nvda, state: 'maybe' }] },
      { budgetUsdc: '500' },
    ]) {
      assert.equal((await validate(proposal.id, body)).statusCode, 400, JSON.stringify(body));
    }
    await app.close();
  });

  it('answers 404 to anyone but the owner', async () => {
    const { app, proposal, stranger } = await withProposal();
    const res = await stranger('POST', `${URL}/${proposal.id}/validations`, { budgetUsdc: '500', items: [] });
    assert.equal(res.statusCode, 404);
    await app.close();
  });
});
