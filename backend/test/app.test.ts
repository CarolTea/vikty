import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { loadConfig } from '../src/config.js';
import { testApp } from './helpers.js';

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
});

describe('config', () => {
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
