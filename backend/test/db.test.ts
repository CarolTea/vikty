import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { migrate } from '../src/db/migrations.js';
import { PgInterpretationStore, type InterpretationRecord } from '../src/interpretations.js';
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
};

describe('migrations', () => {
  it('apply once and are skipped on the next start', async () => {
    const db = await testDb();
    assert.deepEqual(await migrate(db), ['001_interpretations']);
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
});
