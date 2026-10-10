import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { loadConfig } from '../src/config.js';
import { testApp, testConfig } from './helpers.js';

describe('app', () => {
  let app: FastifyInstance;

  before(async () => {
    app = await testApp();
  });

  after(async () => {
    await app.close();
  });

  it('GET /health returns 200', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), { status: 'ok' });
  });

  it('unknown route returns the Error envelope', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/nope' });
    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.json(), { error: { code: 'NOT_FOUND', message: 'Not found.' } });
  });

  it('allows only the app origin', async () => {
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/health',
      headers: { origin: 'https://evil.example', 'access-control-request-method': 'GET' },
    });
    assert.notEqual(res.headers['access-control-allow-origin'], 'https://evil.example');
  });

  it('lets the app origin send PUT and PATCH', async () => {
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/api/v1/interpretations/int_x',
      headers: { origin: 'http://localhost:3000', 'access-control-request-method': 'PATCH' },
    });
    assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:3000');
    const methods = String(res.headers['access-control-allow-methods']).split(/,\s*/);
    assert.ok(methods.includes('PATCH') && methods.includes('PUT'), methods.join());
  });

  it('allows every configured origin, with credentials', async () => {
    const multi = await testApp({ config: testConfig({ WEB_ORIGIN: 'https://victy.finance, https://www.victy.finance/' }) });
    for (const origin of ['https://victy.finance', 'https://www.victy.finance']) {
      const res = await multi.inject({
        method: 'OPTIONS',
        url: '/api/v1/session',
        headers: { origin, 'access-control-request-method': 'GET' },
      });
      assert.equal(res.headers['access-control-allow-origin'], origin);
      assert.equal(res.headers['access-control-allow-credentials'], 'true');
    }
    const other = await multi.inject({
      method: 'OPTIONS',
      url: '/api/v1/session',
      headers: { origin: 'https://victy.finance.evil.example', 'access-control-request-method': 'GET' },
    });
    assert.equal(other.headers['access-control-allow-origin'], undefined);
    await multi.close();
  });
});

describe('trustProxy', () => {
  async function ipFor(trust: string | undefined) {
    const app = await testApp({ config: testConfig(trust === undefined ? {} : { TRUST_PROXY: trust }) });
    app.get('/ip', async (request) => ({ ip: request.ip }));
    const res = await app.inject({ method: 'GET', url: '/ip', remoteAddress: '10.0.0.1', headers: { 'x-forwarded-for': '203.0.113.7' } });
    await app.close();
    return res.json().ip;
  }

  it('ignores X-Forwarded-For by default', async () => {
    assert.equal(await ipFor(undefined), '10.0.0.1');
  });

  it('reads the client address behind the proxy when enabled', async () => {
    assert.equal(await ipFor('true'), '203.0.113.7');
  });

  it('accepts only true or false', () => {
    assert.equal(testConfig({ TRUST_PROXY: 'true' }).TRUST_PROXY, true);
    assert.throws(() => testConfig({ TRUST_PROXY: 'yes' }), /TRUST_PROXY/);
  });
});

describe('config', () => {
  it('reads WEB_ORIGIN as a list of origins', () => {
    assert.deepEqual(testConfig({ WEB_ORIGIN: 'https://victy.finance/ , https://www.victy.finance' }).WEB_ORIGIN, [
      'https://victy.finance',
      'https://www.victy.finance',
    ]);
    for (const bad of ['', 'victy.finance', 'https://victy.finance/app', 'ftp://victy.finance']) {
      assert.throws(() => testConfig({ WEB_ORIGIN: bad }), /WEB_ORIGIN/, bad);
    }
  });

  it('rejects production without secrets', () => {
    assert.throws(
      () =>
        loadConfig({
          NODE_ENV: 'production',
          WEB_ORIGIN: 'https://app.example',
          SOLANA_RPC_URL: 'https://rpc.example',
          DATABASE_URL: 'postgres://u:p@db:5432/x',
          REDIS_URL: 'redis://redis:6379',
        }),
      /JUPITER_API_KEY: required in production/,
    );
  });
});
