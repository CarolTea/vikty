import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { suggestedTheses } from '../src/theses.js';
import { testApp, testDeps } from './helpers.js';
import { buildApp } from '../src/app.js';

const URL = '/api/v1/theses/suggested';

describe('GET /theses/suggested', () => {
  it('lists nothing while no thesis has an approved curated composition', async () => {
    const app = await testApp();
    const res = await app.inject({ method: 'GET', url: URL });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), { items: [] });
    assert.equal(res.headers['cache-control'], 'public, max-age=300');
    await app.close();
  });

  it('lists a thesis once every instrument of its composition is approved, without the curation', async () => {
    const thesis = suggestedTheses[0]!;
    const saved = thesis.composition;
    thesis.composition = {
      items: [{ instrumentId: 'ins_ondo_nvda', exposureIds: [], weightBps: 10_000, rationale: 'x', state: 'active' }],
      excludedInstrumentIds: [],
      limitations: [],
    };
    try {
      const deps = testDeps();
      const app = await buildApp(deps);
      const listed = (await app.inject({ method: 'GET', url: URL })).json();
      assert.deepEqual(listed, { items: [{ id: thesis.id, title: thesis.title, summary: thesis.summary, text: thesis.text }] });

      // The same thesis disappears when one of its instruments loses approval.
      const nvda = deps.catalog.instruments.get('ins_ondo_nvda')!;
      deps.catalog.instruments.set('ins_ondo_nvda', { ...nvda, status: 'restricted' });
      assert.deepEqual((await app.inject({ method: 'GET', url: URL })).json(), { items: [] });
      await app.close();
    } finally {
      if (saved) thesis.composition = saved;
      else delete thesis.composition;
    }
  });
});
