import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { migrate } from '../src/db/migrations.js';
import { PgInterpretationStore, type InterpretationRecord } from '../src/interpretations.js';
import { PgProposalStore, type ProposalRecord } from '../src/proposals.js';
import { testDb } from './helpers.js';

const record: InterpretationRecord = {
  id: 'int_test',
  sessionHash: 'a'.repeat(64),
  wallet: null,
  source: 'free_text',
  curated: false,
  suggestedThesisId: null,
  summary: 'Growing demand for physical AI infrastructure.',
  exposures: [{ id: 'exp_1', label: 'AI semiconductors' }],
  exclusions: [],
  restrictions: [],
  ambiguities: [{ id: 'amb_1', question: 'Energy too?', material: true, options: [], answer: null }],
  representation: 'partial',
  limitations: ['Only part of the theme is covered.'],
  status: 'needs_clarification',
  version: 1,
};

describe('migrations', () => {
  it('apply once and are skipped on the next start', async () => {
    const db = await testDb();
    assert.deepEqual(await migrate(db), ['001_interpretations', '002_proposals', '003_interpretation_versions', '004_plans']);
    assert.deepEqual(await migrate(db), []);
    await db.close();
  });
});

describe('PgInterpretationStore', () => {
  it('stores every field of the interpretation', async () => {
    const db = await testDb();
    await migrate(db);
    await new PgInterpretationStore(db).create(record);

    const [row] = await db.query<Record<string, unknown>>('SELECT * FROM interpretations WHERE id = $1', [record.id]);
    assert.ok(row);
    assert.equal(row['session_hash'], record.sessionHash);
    assert.equal(row['wallet'], null);
    assert.equal(row['source'], 'free_text');
    assert.equal(row['curated'], false);
    assert.equal(row['summary'], record.summary);
    assert.deepEqual(row['exposures'], record.exposures);
    assert.deepEqual(row['ambiguities'], record.ambiguities);
    assert.deepEqual(row['limitations'], record.limitations);
    assert.equal(row['representation'], 'partial');
    assert.equal(row['status'], 'needs_clarification');
    await db.close();
  });

  it('refuses values outside the contract enums', async () => {
    const db = await testDb();
    await migrate(db);
    await assert.rejects(new PgInterpretationStore(db).create({ ...record, status: 'done' as never }));
    await db.close();
  });

  it('reads an interpretation back, or null', async () => {
    const db = await testDb();
    await migrate(db);
    const store = new PgInterpretationStore(db);
    await store.create(record);
    assert.deepEqual(await store.get(record.id), record);
    assert.equal(await store.get('int_nope'), null);
    await db.close();
  });
});

describe('PgInterpretationStore.update', () => {
  it('saves a correction on the expected version, once', async () => {
    const db = await testDb();
    await migrate(db);
    const store = new PgInterpretationStore(db);
    await store.create(record);

    const corrected: InterpretationRecord = {
      ...record,
      exposures: [],
      exclusions: [{ id: 'exc_1', label: 'No fossil fuels' }],
      ambiguities: [{ ...record.ambiguities[0]!, answer: 'opt_1' }],
      status: 'ready',
      version: 2,
    };
    assert.equal(await store.update(corrected), true);
    assert.deepEqual(await store.get(record.id), corrected);

    // A second writer that also started from version 1 loses, and changes nothing.
    assert.equal(await store.update({ ...corrected, exposures: record.exposures }), false);
    assert.deepEqual((await store.get(record.id))?.exposures, []);
    await db.close();
  });

  it('never changes what the AI interpreted', async () => {
    const db = await testDb();
    await migrate(db);
    const store = new PgInterpretationStore(db);
    await store.create(record);
    await store.update({ ...record, summary: 'changed', representation: 'sufficient', limitations: [], version: 2 });

    const saved = await store.get(record.id);
    assert.equal(saved?.summary, record.summary);
    assert.equal(saved?.representation, record.representation);
    assert.deepEqual(saved?.limitations, record.limitations);
    await db.close();
  });
});

describe('PgProposalStore', () => {
  const proposal: ProposalRecord = {
    id: 'prop_1',
    interpretationId: record.id,
    interpretationVersion: 1,
    sessionHash: record.sessionHash,
    wallet: null,
    curated: false,
    budgetUsdc: '500.00',
    items: [{ instrumentId: 'ins_usdc', exposureIds: ['exp_1'], weightBps: 10_000, rationale: 'Liquidity.', state: 'active' }],
    exposures: record.exposures,
    excludedInstrumentIds: ['ins_ondo_nvda'],
    limitations: ['Only part of the theme is covered.'],
  };

  it('stores a proposal, reads it back and finds the latest per interpretation', async () => {
    const db = await testDb();
    await migrate(db);
    await new PgInterpretationStore(db).create(record);
    const store = new PgProposalStore(db);

    await store.create(proposal);
    await store.create({ ...proposal, id: 'prop_2', budgetUsdc: '900' });
    assert.deepEqual(await store.get('prop_1'), proposal);
    assert.equal(await store.get('prop_nope'), null);
    assert.equal((await store.latestFor(record.id, 1))?.id, 'prop_2');
    assert.equal(await store.latestFor(record.id, 2), null, 'another version');
    assert.equal(await store.latestFor('int_other', 1), null);
    await db.close();
  });

  it('refuses a proposal for an interpretation that does not exist', async () => {
    const db = await testDb();
    await migrate(db);
    await assert.rejects(new PgProposalStore(db).create({ ...proposal, interpretationId: 'int_nope' }));
    await db.close();
  });
});
