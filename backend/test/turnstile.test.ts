import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TurnstileBotCheck } from '../src/auth/turnstile.js';
import { ApiError } from '../src/errors.js';

function fakeFetch(respond: () => Response | Promise<Response>) {
  const calls: { url: string; body: unknown }[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)) });
    return respond();
  }) as typeof fetch;
  return { fn, calls };
}

describe('TurnstileBotCheck', () => {
  it('sends secret, token and IP to siteverify and trusts `success`', async () => {
    const { fn, calls } = fakeFetch(() => Response.json({ success: true }));
    const check = new TurnstileBotCheck('secret-key', fn);

    assert.equal(await check.verify('token', '203.0.113.7'), true);
    assert.equal(calls[0]?.url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
    assert.deepEqual(calls[0]?.body, { secret: 'secret-key', response: 'token', remoteip: '203.0.113.7' });
  });

  it('returns false when Cloudflare says no', async () => {
    const { fn } = fakeFetch(() => Response.json({ success: false, 'error-codes': ['invalid-input-response'] }));
    assert.equal(await new TurnstileBotCheck('k', fn).verify('bad', '203.0.113.7'), false);
  });

  it('throws 503 when Cloudflare cannot be reached or errors', async () => {
    for (const respond of [
      () => Promise.reject(new TypeError('fetch failed')),
      () => new Response('oops', { status: 500 }),
    ]) {
      const { fn } = fakeFetch(respond);
      await assert.rejects(new TurnstileBotCheck('k', fn).verify('t', '203.0.113.7'), (err: unknown) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.statusCode, 503);
        assert.equal(err.code, 'UPSTREAM_UNAVAILABLE');
        return true;
      });
    }
  });
});
