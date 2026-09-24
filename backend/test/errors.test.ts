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

const json = { 'content-type': 'application/json' };

describe('error envelope', () => {
  let app: FastifyInstance;

  before(async () => {
    app = await buildApp(config);
    app.post(
      '/echo',
      { schema: { body: { type: 'object', required: ['text'], properties: { text: { type: 'string' } } } } },
      async () => ({ ok: true }),
    );
    app.get('/boom', async () => {
      throw new Error('db password at /app/src/db.ts');
    });
  });

  after(async () => {
    await app.close();
  });

  it('lists the invalid fields', async () => {
    const res = await app.inject({ method: 'POST', url: '/echo', headers: json, payload: '{"text":1}' });
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.json(), {
      error: { code: 'VALIDATION_ERROR', message: 'Some fields are invalid.', details: { fields: ['text'] } },
    });
  });

  it('lists missing fields', async () => {
    const res = await app.inject({ method: 'POST', url: '/echo', headers: json, payload: '{}' });
    assert.deepEqual(res.json().error.details.fields, ['text']);
  });

  it('malformed JSON is a 400, not a 500', async () => {
    const res = await app.inject({ method: 'POST', url: '/echo', headers: json, payload: '{bad json' });
    assert.equal(res.statusCode, 400);
    assert.equal(res.json().error.code, 'VALIDATION_ERROR');
  });

  it('__proto__ in the body is rejected as a 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/echo',
      headers: json,
      payload: '{"text":"a","__proto__":{"isAdmin":true}}',
    });
    assert.equal(res.statusCode, 400);
  });

  it('unexpected errors leak nothing', async () => {
    const res = await app.inject({ method: 'GET', url: '/boom' });
    assert.equal(res.statusCode, 500);
    assert.doesNotMatch(res.body, /password|\/app\/src|\.ts|stack/i);
    assert.deepEqual(res.json(), {
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' },
    });
  });

  it('sends no header that names the stack', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    assert.equal(res.headers['x-powered-by'], undefined);
    assert.equal(res.headers['server'], undefined);
  });
});

describe('coercion', () => {
  let app: FastifyInstance;

  before(async () => {
    app = await buildApp(config);
    app.get(
      '/items',
      { schema: { querystring: { type: 'object', properties: { limit: { type: 'integer' } } } } },
      async (request) => ({ limit: (request.query as { limit: number }).limit }),
    );
  });

  after(async () => {
    await app.close();
  });

  it('query strings are coerced to the declared type', async () => {
    const res = await app.inject({ method: 'GET', url: '/items?limit=20' });
    assert.deepEqual(res.json(), { limit: 20 });
  });
});
