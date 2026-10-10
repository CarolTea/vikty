import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildApp } from '../src/app.js';
import { testDeps } from './helpers.js';

const URL = '/api/v1/instruments';

describe('GET /instruments/{id}', () => {
  it('explains an approved instrument in full', async () => {
    const deps = testDeps();
    deps.availability.states.set('ins_usdc', { buy: 'available', sell: 'no_route', checkedAt: '2026-10-09T12:00:00.000Z' });
    const app = await buildApp(deps);
    const res = await app.inject({ method: 'GET', url: `${URL}/ins_usdc` });

    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['cache-control'], 'no-store');
    const body = res.json();
    assert.equal(body.instrument.symbol, 'USDC');
    assert.equal(body.instrument.mint, 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    assert.equal(body.issuer.name, 'Circle');
    assert.ok(body.issuer.nature);
    assert.ok(body.economicRights.length && body.limitations.length && body.costs.length && body.eligibilityNotes.length);
    assert.deepEqual(body.risks, ['Issuer risk', 'Depeg risk', 'Regulatory risk']);
    assert.ok(body.howToTrade);
    assert.deepEqual(body.availability, { buy: 'available', sell: 'no_route', checkedAt: '2026-10-09T12:00:00.000Z' });
    assert.equal(body.evidence[0].reviewedAt, '2026-10-09');
    await app.close();
  });

  it('answers 404 for an unknown id and for instruments without a confirmed mint or detail', async () => {
    const deps = testDeps();
    const app = await buildApp(deps);
    // ins_ondo_msft has no mint; ins_ondo_nvda is approved in the test catalog but has no detail.
    for (const id of ['ins_nope', 'ins_ondo_msft', 'ins_ondo_nvda']) {
      const res = await app.inject({ method: 'GET', url: `${URL}/${id}` });
      assert.equal(res.statusCode, 404, id);
      assert.equal(res.json().error.code, 'NOT_FOUND');
    }
    await app.close();
  });
});
