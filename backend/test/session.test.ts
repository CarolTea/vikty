import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { LightMyRequestResponse } from 'fastify';
import { pickSolanaWallet } from '../src/auth/privy.js';
import { quotaWindow } from '../src/quota.js';
import { SESSION_COOKIE } from '../src/auth/session.js';
import { testConfig, testDeps, VALID_TOKEN, WALLET } from './helpers.js';
import { buildApp } from '../src/app.js';

const URL = '/api/v1/session';

function sessionCookie(res: LightMyRequestResponse) {
  return res.cookies.find((c) => c.name === SESSION_COOKIE);
}

describe('GET /session — anonymous', () => {
  it('creates a signed, HttpOnly, SameSite=Lax session cookie', async () => {
    const app = await buildApp(testDeps());
    const res = await app.inject({ method: 'GET', url: URL });

    assert.equal(res.statusCode, 200);
    const cookie = sessionCookie(res);
    assert.ok(cookie, 'session cookie set');
    assert.equal(cookie.httpOnly, true);
    assert.equal(cookie.sameSite, 'Lax');
    assert.equal(cookie.path, '/');
    assert.equal(cookie.maxAge, 60 * 60 * 24);
    assert.match(cookie.value, /\./, 'value is signed');
    assert.equal(res.headers['cache-control'], 'no-store');
    assert.deepEqual(res.json(), {
      anonymous: { freeInterpretationAvailable: true },
      wallet: null,
      activePlanId: null,
      activeOperationIds: [],
      limits: { convictionMaxChars: 600 },
    });
    await app.close();
  });

  it('keeps the same session when the cookie comes back, and renews it', async () => {
    const deps = testDeps();
    const app = await buildApp(deps);
    const first = await app.inject({ method: 'GET', url: URL });
    const cookie = sessionCookie(first)!;
    const sessionId = app.unsignCookie(cookie.value).value!;
    deps.quota.anon.set(sessionId, 1);

    const second = await app.inject({ method: 'GET', url: URL, cookies: { [SESSION_COOKIE]: cookie.value } });
    const renewed = sessionCookie(second);
    assert.ok(renewed, 'cookie renewed');
    assert.equal(app.unsignCookie(renewed.value).value, sessionId, 'same session');
    assert.equal(renewed.maxAge, 60 * 60 * 24);
    assert.equal(second.json().anonymous.freeInterpretationAvailable, false);
    await app.close();
  });

  it('replaces a tampered cookie with a new session', async () => {
    const deps = testDeps();
    const app = await buildApp(deps);
    deps.quota.anon.set('forged-id', 1);

    const res = await app.inject({ method: 'GET', url: URL, cookies: { [SESSION_COOKIE]: 'forged-id.badsignature' } });
    const cookie = sessionCookie(res);
    assert.ok(cookie, 'new cookie issued');
    assert.notEqual(app.unsignCookie(cookie.value).value, 'forged-id');
    assert.equal(res.json().anonymous.freeInterpretationAvailable, true);
    await app.close();
  });

  it('marks the cookie Secure in production', async () => {
    const config = testConfig({
      NODE_ENV: 'production',
      JUPITER_API_KEY: 'k',
      AI_API_KEY: 'k',
      PRIVY_APP_ID: 'k',
      PRIVY_APP_SECRET: 'k',
      TURNSTILE_SECRET_KEY: 'k',
    });
    const app = await buildApp(testDeps({ config }));
    const res = await app.inject({ method: 'GET', url: URL });
    assert.equal(sessionCookie(res)?.secure, true);
    await app.close();
  });
});

describe('GET /session — with wallet', () => {
  it('returns the wallet, its network and daily quota', async () => {
    const deps = testDeps();
    const app = await buildApp(deps);
    const { day, resetsAt } = quotaWindow(new Date());
    deps.quota.wallet.set(`${WALLET}:${day}`, 2);

    const res = await app.inject({ method: 'GET', url: URL, headers: { authorization: `Bearer ${VALID_TOKEN}` } });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json().wallet, {
      address: WALLET,
      network: 'solana-mainnet',
      quota: { limit: 20, remaining: 18, resetsAt },
    });
    await app.close();
  });

  it('never reports negative remaining quota', async () => {
    const deps = testDeps();
    const app = await buildApp(deps);
    deps.quota.wallet.set(`${WALLET}:${quotaWindow(new Date()).day}`, 99);
    const res = await app.inject({ method: 'GET', url: URL, headers: { authorization: `Bearer ${VALID_TOKEN}` } });
    assert.equal(res.json().wallet.quota.remaining, 0);
    await app.close();
  });

  it('rejects an invalid token with 401 UNAUTHENTICATED', async () => {
    const app = await buildApp(testDeps());
    const res = await app.inject({ method: 'GET', url: URL, headers: { authorization: 'Bearer expired.token' } });
    assert.equal(res.statusCode, 401);
    assert.equal(res.json().error.code, 'UNAUTHENTICATED');
    await app.close();
  });

  it('rejects an Authorization header that is not a bearer token', async () => {
    const app = await buildApp(testDeps());
    const res = await app.inject({ method: 'GET', url: URL, headers: { authorization: 'Basic dXNlcjpwYXNz' } });
    assert.equal(res.statusCode, 401);
    await app.close();
  });
});

describe('pickSolanaWallet', () => {
  const external = { type: 'wallet', chain_type: 'solana', address: WALLET, wallet_client_type: 'phantom' };

  it('returns the single external Solana wallet', () => {
    assert.equal(pickSolanaWallet({ linked_accounts: [external] } as never), WALLET);
  });

  it('ignores embedded wallets', () => {
    const embedded = { ...external, address: 'Emb', connector_type: 'embedded', wallet_client_type: 'privy' };
    assert.equal(pickSolanaWallet({ linked_accounts: [embedded] } as never), null);
  });

  it('refuses to guess between several wallets', () => {
    const other = { ...external, address: 'Other' };
    assert.equal(pickSolanaWallet({ linked_accounts: [external, other] } as never), null);
  });
});

describe('quotaWindow', () => {
  it('resets at the next UTC midnight', () => {
    assert.deepEqual(quotaWindow(new Date('2026-09-24T23:59:59Z')), {
      day: '2026-09-24',
      resetsAt: '2026-09-25T00:00:00Z',
    });
  });
});
