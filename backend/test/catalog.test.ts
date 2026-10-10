import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { approvedInstruments, devCatalog, findInstrument, instrumentSummary } from '../src/catalog/instruments.js';
import { testConfig } from './helpers.js';
import { registry } from '../src/catalog/registry.js';

const BASE58_MINT = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

describe('Asset Registry', () => {
  it('has unique ids with the ins_ prefix, and unique mints', () => {
    const ids = registry.map((i) => i.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const id of ids) assert.match(id, /^ins_[a-z0-9_]+$/);
    const mints = registry.flatMap((i) => (i.mint ? [i.mint] : []));
    assert.equal(new Set(mints).size, mints.length);
  });

  // PRD §10.3: nothing enters the demo without a confirmed mint and reviewed evidence.
  it('approves only instruments with a confirmed mint, decimals and reviewed evidence', () => {
    for (const i of registry.filter((i) => i.status === 'approved')) {
      assert.match(i.mint ?? '', BASE58_MINT, i.id);
      assert.ok(Number.isInteger(i.decimals) && i.decimals! >= 0 && i.decimals! <= 18, i.id);
      assert.ok(i.evidence.length > 0, `${i.id} has no evidence`);
      assert.ok(i.detail, `${i.id} has no detail for the instrument screen`);
      assert.ok(i.detail.issuerNature && i.detail.howToTrade, i.id);
      assert.ok(i.detail.economicRights.length && i.detail.limitations.length && i.detail.costs.length, i.id);
      for (const e of i.evidence) {
        assert.ok(URL.canParse(e.url), `${i.id}: ${e.url}`);
        assert.match(e.reviewedAt, /^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it('has exactly one cash instrument: USDC', () => {
    const cash = registry.filter((i) => i.kind === 'cash');
    assert.deepEqual(
      cash.map((i) => [i.symbol, i.mint, i.decimals, i.status]),
      [['USDC', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 6, 'approved']],
    );
  });

  it('gives every instrument what a proposal needs to explain it', () => {
    for (const i of registry) {
      assert.ok(i.symbol && i.name && i.exposureLabel && i.represents, i.id);
      assert.ok(i.exposures.length > 0, `${i.id} has no exposures`);
      assert.ok(i.riskTags.length > 0, `${i.id} has no risk tags`);
      assert.ok(URL.canParse(i.sourceUrl), i.id);
    }
  });

  it('looks instruments up by id and builds the contract summary', () => {
    const usdc = findInstrument('ins_usdc')!;
    assert.deepEqual(instrumentSummary(usdc), {
      id: 'ins_usdc',
      symbol: 'USDC',
      name: 'USDC',
      mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      decimals: 6,
      kind: 'cash',
      status: 'approved',
      exposureLabel: 'USD liquidity',
      issuerName: 'Circle',
    });
    assert.equal(findInstrument('ins_nope'), undefined);
    assert.ok(approvedInstruments().every((i) => i.status === 'approved'));
  });

  it('refuses a summary for an instrument without a confirmed mint', () => {
    assert.throws(() => instrumentSummary(findInstrument('ins_ondo_nvda')!), /no confirmed mint/);
  });
});

describe('devCatalog (DEV_APPROVE_DEMO_INSTRUMENTS)', () => {
  it('approves every instrument with a fake mint and placeholder detail, keeping real approvals', () => {
    const dev = devCatalog();
    assert.equal(dev.approved().length, registry.length);
    const nvda = dev.find('ins_ondo_nvda')!;
    assert.equal(nvda.status, 'approved');
    assert.equal(nvda.mint, 'dev-ins_ondo_nvda');
    assert.match(nvda.detail!.limitations[0]!, /local testing/);
    assert.deepEqual(dev.find('ins_usdc'), findInstrument('ins_usdc'));
    // The real registry is untouched.
    assert.equal(findInstrument('ins_ondo_nvda')!.status, 'unavailable');
  });

  it('is off by default and refused in production', () => {
    assert.equal(testConfig().DEV_APPROVE_DEMO_INSTRUMENTS, false);
    assert.equal(testConfig({ DEV_APPROVE_DEMO_INSTRUMENTS: 'true' }).DEV_APPROVE_DEMO_INSTRUMENTS, true);
    assert.throws(() => testConfig({ NODE_ENV: 'production', DEV_APPROVE_DEMO_INSTRUMENTS: 'true' }), /DEV_APPROVE_DEMO_INSTRUMENTS: never in production/);
  });
});
