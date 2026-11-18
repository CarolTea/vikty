import { renderHook } from '@testing-library/react';
import { parse } from 'yaml';
import specYaml from '../../../Docs/api/openapi.yaml?raw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApi } from './client';
import { ERROR_CODES, errorMessageKey, FALLBACK_ERROR_KEY, useErrorMessage } from './errors';
import { buildUrl, createHttpTransport } from './http';
import { createMockTransport } from './mock/transport';
import { ApiError } from './transport';
import errors from '../i18n/locales/en/errors.json';

describe('mock transport', () => {
  const api = createApi(createMockTransport({ latencyMs: 0 }));

  it('serves a contract example', async () => {
    const session = await api.getSession();
    expect(session.limits.convictionMaxChars).toBe(600);
    const theses = await api.listSuggestedTheses();
    expect(theses.items.length).toBeGreaterThan(0);
  });

  it('matches path templates and answers 204 with no body', async () => {
    await expect(api.trackEvents({ events: [] })).resolves.toBeUndefined();
  });

  it('throws NOT_FOUND when the route has no example', async () => {
    await expect(createMockTransport({ latencyMs: 0 }).request('GET', '/nowhere')).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });
  });

  it('serves the first example by default and a named one on request', async () => {
    const first = await api.getOperation('op_3f9');
    expect(first.status).toBe('confirmed');
    expect(first.result.outputAmount).not.toBeNull();
    const pending = await api.getOperation('op_3f9', { mockExample: 'pendente' });
    expect(pending.status).toBe('pending');
    const prepared = await api.prepareOperation(
      { planId: 'plan_7d1', side: 'buy', instrumentId: 'ins_pwre', inputUsdc: '175.00' },
      'key-1',
      { token: 't' },
    );
    expect(prepared.status).toBe('ready_for_review');
    const plan = await api.getPlan('plan_7d1', { token: 't' });
    expect(plan.items.reduce((sum, i) => sum + i.weightBps, 0)).toBe(10000);
  });

  it('serves a forced error status with details and retryAfter', async () => {
    const limited = createApi(createMockTransport({ latencyMs: 0, status: 429 }));
    const err = await limited.getSession().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 429, code: 'RATE_LIMITED', retryAfter: 30 });
  });
});

describe('http transport', () => {
  afterEach(() => vi.unstubAllGlobals());

  const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { status, headers });

  it('builds the URL, headers and credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(201, { id: 'plan_1' }));
    vi.stubGlobal('fetch', fetchMock);
    const transport = createHttpTransport('http://api.test/api/v1/');
    await transport.request('POST', '/plans', {
      body: { a: 1 },
      query: { active: true, skip: undefined },
      token: 'tok',
      idempotencyKey: 'key-1',
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://api.test/api/v1/plans?active=true');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    expect(init.body).toBe('{"a":1}');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer tok',
      'Idempotency-Key': 'key-1',
      'Content-Type': 'application/json',
    });
  });

  it('parses the error envelope into an ApiError', async () => {
    const body = { error: { code: 'TEXT_TOO_LONG', message: 'x', retryAfter: null, details: { max: 600 } } };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(400, body)));
    const err = await createHttpTransport('http://api.test').request('GET', '/x').catch((e: unknown) => e);
    expect(err).toMatchObject({ status: 400, code: 'TEXT_TOO_LONG', details: { max: 600 } });
  });

  it('reads Retry-After from the header when the body has none', async () => {
    const body = { error: { code: 'RATE_LIMITED', message: 'x', retryAfter: null } };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(429, body, { 'Retry-After': '12' })));
    const err = await createHttpTransport('http://api.test').request('GET', '/x').catch((e: unknown) => e);
    expect(err).toMatchObject({ code: 'RATE_LIMITED', retryAfter: 12 });
  });

  it('maps network failures and malformed bodies to typed errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('failed')));
    await expect(createHttpTransport('http://api.test').request('GET', '/x')).rejects.toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR',
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>', { status: 502 })));
    await expect(createHttpTransport('http://api.test').request('GET', '/x')).rejects.toMatchObject({
      status: 502,
      code: 'UNKNOWN_ERROR',
    });
  });

  it('returns undefined for 204', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(createHttpTransport('http://api.test').request('POST', '/events')).resolves.toBeUndefined();
  });

  it('buildUrl omits an empty query string', () => {
    expect(buildUrl('http://a/b', '/c')).toBe('http://a/b/c');
  });
});

describe('error messages', () => {
  const spec = parse(specYaml) as {
    components: { schemas: { Error: { properties: { error: { properties: { code: { enum: string[] } } } } } } };
  };
  const contractCodes = spec.components.schemas.Error.properties.error.properties.code.enum;

  it('has a translation for every contract code', () => {
    expect(contractCodes.length).toBeGreaterThan(0);
    for (const code of [...contractCodes, 'NETWORK_ERROR', 'UNKNOWN_ERROR']) {
      const key = errorMessageKey(code);
      if (code !== 'UNKNOWN_ERROR') expect(key, code).not.toBe(FALLBACK_ERROR_KEY);
      expect(errors, code).toHaveProperty(key);
    }
    expect(ERROR_CODES).toEqual(expect.arrayContaining(contractCodes));
  });

  it('falls back for unknown codes', () => {
    expect(errorMessageKey('SOMETHING_NEW')).toBe(FALLBACK_ERROR_KEY);
    expect(errors).toHaveProperty(FALLBACK_ERROR_KEY);
  });

  it('useErrorMessage interpolates details and never shows the API message', () => {
    const { result } = renderHook(() => useErrorMessage());
    const tooLong = new ApiError({ status: 400, code: 'TEXT_TOO_LONG', message: 'API TEXT', details: { max: 600 } });
    expect(result.current(tooLong)).toContain('600');
    expect(result.current(tooLong)).not.toContain('API TEXT');
    const limited = new ApiError({ status: 429, code: 'RATE_LIMITED', retryAfter: 30 });
    expect(result.current(limited)).toContain('30');
    expect(result.current(new Error('boom'))).toBe(errors[FALLBACK_ERROR_KEY]);
  });
});
