import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Instrument } from '../src/catalog/instruments.js';
import { findInstrument } from '../src/catalog/instruments.js';
import {
  duplicateInstrumentIds,
  policyFromConfig,
  policyVersion,
  validateDraft,
  type Availability,
  type DraftItem,
  type ValidationContext,
} from '../src/composition.js';
import { testConfig } from './helpers.js';

const policy = policyFromConfig(testConfig());

// Registry entries, approved for the test (the real registry approves only USDC so far).
const approved = (id: string): Instrument => ({ ...findInstrument(id)!, status: 'approved', mint: `Mint${id}`, decimals: 6 });
const instruments = new Map(
  [approved('ins_ondo_nvda'), approved('ins_ondo_vrt'), approved('ins_ondo_ceg'), findInstrument('ins_usdc')!].map((i) => [i.id, i]),
);
instruments.set('ins_ondo_amd', findInstrument('ins_ondo_amd')!); // still unavailable

const open: Availability = { buy: 'available', sell: 'available', checkedAt: '2026-10-09T12:00:00Z' };

function context(overrides: Partial<ValidationContext> = {}): ValidationContext {
  return {
    policy,
    proposalItems: [
      { instrumentId: 'ins_ondo_nvda', exposureIds: ['exp_1'] },
      { instrumentId: 'ins_ondo_amd', exposureIds: ['exp_1'] },
      { instrumentId: 'ins_ondo_vrt', exposureIds: ['exp_2'] },
      { instrumentId: 'ins_ondo_ceg', exposureIds: ['exp_3'] },
      { instrumentId: 'ins_usdc', exposureIds: [] },
    ],
    exposures: [
      { id: 'exp_1', label: 'AI semiconductors' },
      { id: 'exp_2', label: 'Data centers' },
      { id: 'exp_3', label: 'Power generation' },
    ],
    excludedInstrumentIds: [],
    availability: new Map([...instruments.keys()].map((id) => [id, open])),
    lookup: (id) => instruments.get(id),
    ...overrides,
  };
}

const VALID: DraftItem[] = [
  { instrumentId: 'ins_ondo_nvda', weightBps: 3500, state: 'active' },
  { instrumentId: 'ins_ondo_amd', weightBps: 0, state: 'rejected' },
  { instrumentId: 'ins_ondo_vrt', weightBps: 2500, state: 'active' },
  { instrumentId: 'ins_ondo_ceg', weightBps: 2500, state: 'active' },
  { instrumentId: 'ins_usdc', weightBps: 1500, state: 'active' },
];

const codes = (r: ReturnType<typeof validateDraft>) => r.validation.issues.map((i) => `${i.code}:${i.instrumentId}`);
const withItem = (id: string, patch: Partial<DraftItem>) => VALID.map((i) => (i.instrumentId === id ? { ...i, ...patch } : i));

describe('validateDraft', () => {
  it('accepts a valid draft and plans the budget by weight', () => {
    const r = validateDraft('500.00', VALID, context());

    assert.deepEqual(r.validation, {
      valid: true,
      conclusive: true,
      totalBps: 10_000,
      issues: [],
      policyVersion: policyVersion(policy),
    });
    assert.deepEqual(Object.fromEntries(r.plannedUsdc), {
      ins_ondo_nvda: '175.00',
      ins_ondo_amd: '0.00',
      ins_ondo_vrt: '125.00',
      ins_ondo_ceg: '125.00',
      ins_usdc: '75.00',
    });
  });

  it('reports a sum other than 100% and never redistributes', () => {
    const items = withItem('ins_ondo_ceg', { state: 'rejected' });
    const r = validateDraft('500', items, context());

    assert.equal(r.validation.valid, false);
    assert.equal(r.validation.totalBps, 7500);
    assert.deepEqual(codes(r), ['SUM_NOT_100:null', 'PARTIAL_REPRESENTATION:null']);
    assert.equal(r.validation.issues[0]!.message, 'Weights add up to 75%. Adjust them to reach 100%.');
    assert.equal(r.plannedUsdc.get('ins_ondo_ceg'), '0.00');
    assert.equal(r.plannedUsdc.get('ins_ondo_nvda'), '175.00', 'others keep their weight');
  });

  it('enforces the weight limits on active assets', () => {
    const above = validateDraft(
      '500',
      withItem('ins_ondo_nvda', { weightBps: 4500 }).map((i) => (i.instrumentId === 'ins_usdc' ? { ...i, weightBps: 500 } : i)),
      context(),
    );
    assert.deepEqual(codes(above), ['WEIGHT_ABOVE_MAX:ins_ondo_nvda']);
    assert.deepEqual(above.validation.issues[0]!.params, { weightBps: 4500, maxBps: 4000 });
    assert.equal(above.validation.issues[0]!.message, 'NVDAon is at 45%. The limit per asset is 40%.');

    const below = validateDraft(
      '500',
      withItem('ins_usdc', { weightBps: 100 }).map((i) => (i.instrumentId === 'ins_ondo_ceg' ? { ...i, weightBps: 3900 } : i)),
      context(),
    );
    assert.deepEqual(codes(below), ['WEIGHT_BELOW_MIN:ins_usdc']);
  });

  it('refuses instruments the proposal did not offer, even rejected ones', () => {
    for (const state of ['active', 'rejected'] as const) {
      const items = [...VALID, { instrumentId: 'ins_ondo_msft', weightBps: 0, state }];
      assert.ok(codes(validateDraft('500', items, context())).includes('INCOMPATIBLE_SUBSTITUTION:ins_ondo_msft'));
    }
    const external = validateDraft('500', [...VALID, { instrumentId: 'So1111', weightBps: 0, state: 'rejected' }], context());
    assert.equal(external.validation.issues[0]!.message, "This asset wasn't part of this proposal. Only its original assets can be used.");
  });

  it('refuses active instruments that are not approved, but lets them be rejected', () => {
    const items = withItem('ins_ondo_amd', { state: 'active', weightBps: 1000 }).map((i) =>
      i.instrumentId === 'ins_ondo_nvda' ? { ...i, weightBps: 2500 } : i,
    );
    const r = validateDraft('500', items, context());
    assert.deepEqual(codes(r), ['INSTRUMENT_NOT_APPROVED:ins_ondo_amd']);
    assert.deepEqual(r.validation.issues[0]!.params, { status: 'unavailable' });
  });

  it('refuses an active asset ruled out by an exclusion', () => {
    const r = validateDraft('500', VALID, context({ excludedInstrumentIds: ['ins_ondo_ceg', 'ins_ondo_amd'] }));
    assert.deepEqual(codes(r), ['EXCLUSION_VIOLATED:ins_ondo_ceg']);
  });

  it('checks the budget against the policy', () => {
    for (const budget of ['0', '0.5', '10000.01', '-5', '1e3', 'abc', '1.0000001']) {
      const r = validateDraft(budget, VALID, context());
      assert.deepEqual(codes(r), ['BUDGET_INVALID:null'], budget);
      assert.equal(r.validation.issues[0]!.message, 'Enter a budget between 1 and 10000 USDC.');
      assert.ok([...r.plannedUsdc.values()].every((v) => v === '0.00'));
    }
    for (const budget of ['1', '10000', '123.456789']) {
      assert.equal(validateDraft(budget, VALID, context()).validation.valid, true, budget);
    }
  });

  it('warns about missing routes and is inconclusive without availability', () => {
    const availability = new Map(context().availability);
    availability.set('ins_ondo_vrt', { ...open, buy: 'no_route' });
    const noRoute = validateDraft('500', VALID, context({ availability }));
    assert.deepEqual(codes(noRoute), ['NO_ROUTE:ins_ondo_vrt']);
    assert.equal(noRoute.validation.valid, true, 'a warning does not invalidate');
    assert.equal(noRoute.validation.conclusive, true);

    availability.set('ins_ondo_ceg', { buy: 'unknown', sell: 'unknown', checkedAt: null });
    const unknown = validateDraft('500', VALID, context({ availability }));
    assert.equal(unknown.validation.conclusive, false);
    assert.equal(unknown.validation.valid, true);
    assert.deepEqual(codes(unknown), ['NO_ROUTE:ins_ondo_vrt'], 'unknown is not a missing route');

    availability.delete('ins_ondo_ceg');
    assert.equal(validateDraft('500', VALID, context({ availability })).validation.conclusive, false);
  });

  it('expects unique instrument ids', () => {
    const items = [...VALID, VALID[0]!];
    assert.deepEqual(duplicateInstrumentIds(items), ['ins_ondo_nvda']);
    assert.deepEqual(duplicateInstrumentIds(VALID), []);
    assert.throws(() => validateDraft('500', items, context()));
  });

  it('uses the real registry by default', () => {
    const r = validateDraft('500', VALID, context({ lookup: undefined as never }));
    assert.ok(codes(r).includes('INSTRUMENT_NOT_APPROVED:ins_ondo_nvda'));
    assert.ok(!codes(r).includes('INSTRUMENT_NOT_APPROVED:ins_usdc'));
  });
});

describe('policy', () => {
  it('comes from configuration, and its version names the values', () => {
    const custom = policyFromConfig(testConfig({ MAX_WEIGHT_BPS: '3000', MIN_BUDGET_USDC: '10' }));
    assert.deepEqual(custom, { maxWeightBps: 3000, minWeightBps: 500, minBudgetUsdc: '10', maxBudgetUsdc: '10000' });
    assert.equal(policyVersion(custom), 'v1;weight=500-3000;budget=10-10000');
  });

  it('refuses inconsistent limits at startup', () => {
    assert.throws(() => testConfig({ MIN_WEIGHT_BPS: '5000', MAX_WEIGHT_BPS: '4000' }), /MIN_WEIGHT_BPS/);
    assert.throws(() => testConfig({ MIN_BUDGET_USDC: '100', MAX_BUDGET_USDC: '50' }), /MIN_BUDGET_USDC/);
    assert.throws(() => testConfig({ MAX_BUDGET_USDC: '1e4' }), /MAX_BUDGET_USDC/);
  });
});
