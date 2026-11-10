import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';
import { buildApp } from '../src/app.js';
import { SESSION_COOKIE, sessionHash } from '../src/auth/session.js';
import { migrate } from '../src/db/migrations.js';
import { PgEventStore } from '../src/events.js';
import { testDb, testDeps, VALID_TOKEN, WALLET } from './helpers.js';

describe('GET /theses/suggested', () => {
  it('lists the suggested theses without their curated interpretation', async () => {
    const app = await buildApp(testDeps());
    const res = await app.inject({ method: 'GET', url: '/api/v1/theses/suggested' });

    assert.equal(res.statusCode, 200);
    const { items } = res.json();
    assert.ok(items.length > 0);
    for (const item of items) {
      assert.deepEqual(Object.keys(item).sort(), ['id', 'summary', 'text', 'title']);
    }
    assert.deepEqual(items[0], {
      id: 'th_ai_infra',
      title: 'AI infrastructure',
      summary: 'Chips, data centers and the energy that power AI.',
      text: 'AI will reshape data center infrastructure over the next 5 years.',
    });
    await app.close();
  });
});

const EVENTS = '/api/v1/events';
const AT = '2026-09-30T14:00:00Z';

async function setup() {
  const deps = testDeps();
  const app = await buildApp(deps);
  const session = await app.inject({ method: 'GET', url: '/api/v1/session' });
  const cookie = session.cookies.find((c) => c.name === SESSION_COOKIE)!.value;
  const sessionId = app.unsignCookie(cookie).value!;
  const post = (payload: object, headers: Record<string, string> = {}) =>
    app.inject({ method: 'POST', url: EVENTS, payload, headers, cookies: { [SESSION_COOKIE]: cookie } });
  return { deps, app, sessionId, post };
}

describe('POST /events', () => {
  it('records discovery_started with a pseudonymous session and answers 204', async () => {
    const { deps, app, sessionId, post } = await setup();
    const res = await post({ events: [{ name: 'discovery_started', at: AT, props: { source: 'suggested' } }] });

    assert.equal(res.statusCode, 204);
    assert.equal(res.body, '');
    assert.deepEqual(deps.events.records, [
      {
        name: 'discovery_started',
        occurredAt: AT,
        props: { source: 'suggested' },
        sessionHash: sessionHash(sessionId),
        walletHash: null,
      },
    ]);
    await app.close();
  });

  it('stores a hash of the wallet, never the address', async () => {
    const { deps, app, post } = await setup();
    await post({ events: [{ name: 'discovery_started', at: AT }] }, { authorization: `Bearer ${VALID_TOKEN}` });

    const [event] = deps.events.records;
    assert.equal(event?.walletHash, createHash('sha256').update(WALLET).digest('hex'));
    assert.ok(!JSON.stringify(deps.events.records).includes(WALLET));
    await app.close();
  });

  it('refuses a name outside the closed list', async () => {
    const { deps, app, post } = await setup();
    const res = await post({ events: [{ name: 'proposal_created', at: AT }] });
    assert.equal(res.statusCode, 400);
    assert.equal(res.json().error.code, 'VALIDATION_ERROR');
    assert.equal(deps.events.records.length, 0);
    await app.close();
  });

  it('refuses a wallet address in props', async () => {
    const { deps, app, post } = await setup();
    const res = await post({ events: [{ name: 'discovery_started', at: AT, props: { wallet: WALLET } }] });
    assert.equal(res.statusCode, 400);
    assert.equal(deps.events.records.length, 0);
    await app.close();
  });

  it('refuses long text in props (the conviction never goes to analytics)', async () => {
    const { app, post } = await setup();
    const text = "AI will reshape data center infrastructure over the next 5 years, but I don't want to depend on a single company.";
    const res = await post({ events: [{ name: 'discovery_started', at: AT, props: { text } }] });
    assert.equal(res.statusCode, 400);
    await app.close();
  });

  it('refuses an empty batch, a batch over 50 and a bad date', async () => {
    const { app, post } = await setup();
    const many = Array.from({ length: 51 }, () => ({ name: 'discovery_started', at: AT }));
    for (const events of [[], many, [{ name: 'discovery_started', at: 'yesterday' }]]) {
      const res = await post({ events });
      assert.equal(res.statusCode, 400, JSON.stringify(events).slice(0, 60));
    }
    await app.close();
  });

  it('answers 401 for an invalid token', async () => {
    const { app, post } = await setup();
    const res = await post({ events: [{ name: 'discovery_started', at: AT }] }, { authorization: 'Bearer expired.token' });
    assert.equal(res.statusCode, 401);
    await app.close();
  });
});

describe('PgEventStore', () => {
  it('stores a batch in one insert', async () => {
    const db = await testDb();
    await migrate(db);
    const owner = { sessionHash: 'a'.repeat(64), walletHash: null };
    await new PgEventStore(db).record([
      { name: 'discovery_started', occurredAt: AT, props: { source: 'free_text' }, ...owner },
      { name: 'suggested_thesis_selected', occurredAt: AT, props: {}, ...owner },
    ]);

    const rows = await db.query<{ name: string; props: unknown }>('SELECT name, props FROM events ORDER BY id');
    assert.deepEqual(rows, [
      { name: 'discovery_started', props: { source: 'free_text' } },
      { name: 'suggested_thesis_selected', props: {} },
    ]);
    await db.close();
  });
});
