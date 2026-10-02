import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildApp } from '../src/app.js';
import { SESSION_COOKIE, sessionHash } from '../src/auth/session.js';
import { ApiError } from '../src/errors.js';
import { quotaWindow } from '../src/quota.js';
import { AI_ANSWER, HUMAN_TOKEN, testConfig, testDeps, VALID_TOKEN, WALLET } from './helpers.js';

const URL = '/api/v1/interpretations';
const TEXT = "AI will reshape data center infrastructure over the next 5 years, but I don't want to depend on a single company.";

async function setup(overrides: Parameters<typeof testDeps>[0] = {}) {
  const deps = testDeps(overrides);
  const app = await buildApp(deps);
  // Start from a known session, like the front does after GET /session.
  const session = await app.inject({ method: 'GET', url: '/api/v1/session' });
  const cookie = session.cookies.find((c) => c.name === SESSION_COOKIE)!.value;
  const sessionId = app.unsignCookie(cookie).value!;
  const post = (payload: object, headers: Record<string, string> = {}) =>
    app.inject({ method: 'POST', url: URL, payload, headers, cookies: { [SESSION_COOKIE]: cookie } });
  return { deps, app, sessionId, post };
}

const anonymous = { source: 'free_text', text: TEXT, botCheckToken: HUMAN_TOKEN, deviceHash: '9f2c1e7ab3' };
const withWallet = { authorization: `Bearer ${VALID_TOKEN}` };
const today = () => quotaWindow(new Date());

describe('POST /interpretations — suggested thesis', () => {
  it('returns the curated interpretation without AI, quota or bot check', async () => {
    const { deps, app, sessionId, post } = await setup();
    const res = await post({ source: 'suggested', suggestedThesisId: 'th_ai_infra' });

    assert.equal(res.statusCode, 201);
    const body = res.json();
    assert.match(body.id, /^int_/);
    assert.equal(res.headers.location, `${URL}/${body.id}`);
    assert.equal(body.source, 'suggested');
    assert.equal(body.curated, true);
    assert.equal(body.representation, 'sufficient');
    assert.equal(body.status, 'ready');
    assert.deepEqual(body.quota, { anonymousFreeUsed: false, wallet: null });

    assert.equal(deps.interpreter.calls.length, 0, 'no AI call');
    assert.equal(deps.botCheck.calls.length, 0, 'no bot check');
    assert.equal(deps.quota.anon.get(sessionId) ?? 0, 0, 'no quota');
    const [stored] = deps.interpretations.records;
    assert.equal(stored?.id, body.id);
    assert.equal(stored?.suggestedThesisId, 'th_ai_infra');
    assert.equal(stored?.sessionHash, sessionHash(sessionId));
    await app.close();
  });

  it('rejects an unknown thesis id', async () => {
    const { app, post } = await setup();
    const res = await post({ source: 'suggested', suggestedThesisId: 'th_nope' });

    assert.equal(res.statusCode, 400);
    assert.equal(res.json().error.code, 'VALIDATION_ERROR');
    assert.deepEqual(res.json().error.details, { fields: ['suggestedThesisId'] });
    await app.close();
  });
});

describe('POST /interpretations — body validation', () => {
  it('points at `source` when it is missing or unknown', async () => {
    const { app, post } = await setup();
    for (const payload of [{ text: TEXT }, { source: 'other', text: TEXT }]) {
      const res = await post(payload);
      assert.equal(res.statusCode, 400);
      assert.equal(res.json().error.code, 'VALIDATION_ERROR');
      assert.deepEqual(res.json().error.details, { fields: ['source'] });
    }
    await app.close();
  });

  it('requires the field of the chosen source', async () => {
    const { app, post } = await setup();
    const res = await post({ source: 'free_text', botCheckToken: HUMAN_TOKEN });
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.json().error.details, { fields: ['text'] });
    await app.close();
  });

  it('rejects blank text', async () => {
    const { deps, app, post } = await setup();
    const res = await post({ ...anonymous, text: '   ' });
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.json().error, { code: 'VALIDATION_ERROR', message: 'Some fields are invalid.', details: { fields: ['text'] } });
    assert.equal(deps.interpreter.calls.length, 0);
    await app.close();
  });

  it('answers TEXT_TOO_LONG over the configured limit', async () => {
    const { deps, app, sessionId, post } = await setup({ config: testConfig({ CONVICTION_MAX_CHARS: '20' }) });
    const res = await post({ ...anonymous, text: 'x'.repeat(21) });

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.json().error, {
      code: 'TEXT_TOO_LONG',
      message: 'Your thesis is over 20 characters.',
      details: { max: 20 },
    });
    assert.equal(deps.quota.anon.get(sessionId) ?? 0, 0, 'no quota spent');
    await app.close();
  });
});

describe('POST /interpretations — free text, anonymous', () => {
  it('checks the bot token, spends the free interpretation and stores the result', async () => {
    const { deps, app, sessionId, post } = await setup();
    const res = await post(anonymous);

    assert.equal(res.statusCode, 201);
    const body = res.json();
    assert.equal(res.headers.location, `${URL}/${body.id}`);
    assert.deepEqual(body, {
      id: body.id,
      source: 'free_text',
      curated: false,
      summary: AI_ANSWER.summary,
      exposures: [
        { id: 'exp_1', label: 'AI semiconductors' },
        { id: 'exp_2', label: 'Data centers' },
      ],
      exclusions: [{ id: 'exc_1', label: "Don't depend on a single company" }],
      restrictions: [],
      ambiguities: [
        {
          id: 'amb_1',
          question: 'Should energy for data centers be part of the thesis?',
          material: true,
          options: [
            { id: 'opt_1', label: 'Yes, include it' },
            { id: 'opt_2', label: 'No, compute only' },
          ],
          answer: null,
        },
      ],
      representation: 'sufficient',
      limitations: [],
      status: 'needs_clarification',
      quota: { anonymousFreeUsed: true, wallet: null },
    });

    assert.deepEqual(deps.botCheck.calls.map((c) => c.token), [HUMAN_TOKEN]);
    assert.deepEqual(deps.interpreter.calls, [TEXT]);
    assert.equal(deps.quota.anon.get(sessionId), 1);
    const [stored] = deps.interpretations.records;
    assert.equal(stored?.id, body.id);
    assert.equal(stored?.wallet, null);
    assert.ok(!JSON.stringify(stored).includes(TEXT), 'the conviction text is not stored');
    await app.close();
  });

  it('is ready when there is no material ambiguity left', async () => {
    const { deps, app, post } = await setup();
    deps.interpreter.answer = {
      ...AI_ANSWER,
      ambiguities: [{ question: 'Any region?', material: false, options: ['US', 'Global'] }],
    };
    const res = await post(anonymous);
    assert.equal(res.json().status, 'ready');
    await app.close();
  });

  it('accepts "insufficient" as a valid answer, with limitations', async () => {
    const { deps, app, post } = await setup();
    deps.interpreter.answer = {
      ...AI_ANSWER,
      exposures: [],
      ambiguities: [],
      representation: 'insufficient',
      limitations: ['No approved instrument represents this theme yet.'],
    };
    const res = await post(anonymous);
    assert.equal(res.statusCode, 201);
    assert.equal(res.json().representation, 'insufficient');
    assert.deepEqual(res.json().limitations, ['No approved instrument represents this theme yet.']);
    await app.close();
  });

  it('refuses without a bot token, or with a failing one, and spends nothing', async () => {
    const { deps, app, sessionId, post } = await setup();
    for (const payload of [{ source: 'free_text', text: TEXT }, { ...anonymous, botCheckToken: 'bot' }]) {
      const res = await post(payload);
      assert.equal(res.statusCode, 403);
      assert.equal(res.json().error.code, 'BOT_CHECK_FAILED');
    }
    assert.equal(deps.quota.anon.get(sessionId) ?? 0, 0);
    assert.equal(deps.interpreter.calls.length, 0);
    await app.close();
  });

  it('refuses a second free interpretation with ANON_QUOTA_USED', async () => {
    const { deps, app, sessionId, post } = await setup();
    assert.equal((await post(anonymous)).statusCode, 201);
    const res = await post(anonymous);

    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.json().error, {
      code: 'ANON_QUOTA_USED',
      message: 'You have used your free interpretation. Connect your wallet to interpret again.',
    });
    assert.equal(deps.interpreter.calls.length, 1, 'AI not called again');
    assert.equal(deps.quota.anon.get(sessionId), 1, 'counter back at the limit');
    await app.close();
  });

  it('gives the free interpretation back when the AI fails', async () => {
    const { deps, app, sessionId, post } = await setup();
    deps.interpreter.answer = new Error('provider timeout');
    const res = await post(anonymous);

    assert.equal(res.statusCode, 503);
    assert.equal(res.json().error.code, 'AI_UNAVAILABLE');
    assert.equal(deps.quota.anon.get(sessionId), 0);
    assert.equal(deps.interpretations.records.length, 0);
    await app.close();
  });

  it('treats an AI answer outside the schema as AI_UNAVAILABLE', async () => {
    const { deps, app, sessionId, post } = await setup();
    const bad = [
      { ...AI_ANSWER, representation: 'great' },
      { ...AI_ANSWER, instrumentMint: 'So11111111111111111111111111111111111111112' },
      { ...AI_ANSWER, ambiguities: [{ question: 'Q?', material: true, options: ['only one'] }] },
      'not an object',
    ];
    for (const answer of bad) {
      deps.interpreter.answer = answer;
      const res = await post(anonymous);
      assert.equal(res.statusCode, 503, JSON.stringify(answer));
      assert.equal(res.json().error.code, 'AI_UNAVAILABLE');
    }
    assert.equal(deps.quota.anon.get(sessionId), 0);
    await app.close();
  });

  it('gives the free interpretation back when saving fails', async () => {
    const { deps, app, sessionId, post } = await setup();
    deps.interpretations.fail = true;
    const res = await post(anonymous);

    assert.equal(res.statusCode, 500);
    assert.equal(deps.quota.anon.get(sessionId), 0);
    await app.close();
  });
});

describe('POST /interpretations — free text, with wallet', () => {
  it('spends the wallet quota and needs no bot token', async () => {
    const { deps, app, sessionId, post } = await setup();
    const res = await post({ source: 'free_text', text: TEXT }, withWallet);

    assert.equal(res.statusCode, 201);
    const { day, resetsAt } = today();
    assert.deepEqual(res.json().quota, {
      anonymousFreeUsed: false,
      wallet: { limit: 20, remaining: 19, resetsAt },
    });
    assert.equal(deps.quota.wallet.get(`${WALLET}:${day}`), 1);
    assert.equal(deps.quota.anon.get(sessionId) ?? 0, 0, 'free interpretation untouched');
    assert.equal(deps.botCheck.calls.length, 0);
    assert.equal(deps.interpretations.records[0]?.wallet, WALLET);
    await app.close();
  });

  it('refuses with WALLET_QUOTA_USED when the day is used up', async () => {
    const { deps, app, post } = await setup();
    const { day, resetsAt } = today();
    deps.quota.wallet.set(`${WALLET}:${day}`, 20);
    const res = await post({ source: 'free_text', text: TEXT }, withWallet);

    assert.equal(res.statusCode, 403);
    assert.equal(res.json().error.code, 'WALLET_QUOTA_USED');
    assert.deepEqual(res.json().error.details, { resetsAt });
    assert.equal(deps.quota.wallet.get(`${WALLET}:${day}`), 20);
    assert.equal(deps.interpreter.calls.length, 0);
    await app.close();
  });

  it('answers 401 for an invalid token instead of falling back to anonymous', async () => {
    const { deps, app, sessionId, post } = await setup();
    const res = await post(anonymous, { authorization: 'Bearer expired.token' });

    assert.equal(res.statusCode, 401);
    assert.equal(res.json().error.code, 'UNAUTHENTICATED');
    assert.equal(deps.quota.anon.get(sessionId) ?? 0, 0);
    await app.close();
  });

  it('answers 503 when Privy is down', async () => {
    const { app, post } = await setup({
      wallets: {
        async resolve() {
          throw new ApiError(503, 'UPSTREAM_UNAVAILABLE', 'Sign-in is temporarily unavailable. Try again in a moment.');
        },
      },
    });
    const res = await post({ source: 'free_text', text: TEXT }, withWallet);
    assert.equal(res.statusCode, 503);
    assert.equal(res.json().error.code, 'UPSTREAM_UNAVAILABLE');
    await app.close();
  });
});
