import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

const config = loadConfig({
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  WEB_ORIGIN: 'http://localhost:3000',
  SOLANA_RPC_URL: 'https://api.mainnet-beta.solana.com',
  DATABASE_URL: 'postgres://vikty:vikty@localhost:5432/vikty',
  REDIS_URL: 'redis://localhost:6379',
});

describe('app', () => {
  let app: FastifyInstance;

  before(async () => {
    app = await buildApp(config);
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
