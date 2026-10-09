import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatPercent, formatUsdc, parseUsdc, shareOf } from '../src/money.js';

describe('money', () => {
  it('parses decimal strings into micro-USDC', () => {
    assert.equal(parseUsdc('500'), 500_000_000n);
    assert.equal(parseUsdc('175.5'), 175_500_000n);
    assert.equal(parseUsdc('0.000001'), 1n);
    assert.equal(parseUsdc('007.10'), 7_100_000n);
  });

  it('refuses anything that is not a plain non-negative decimal with up to 6 places', () => {
    for (const text of ['', '-1', '1e3', '1.', '.5', '1,5', ' 1', '0.0000001', 'NaN', '1.2.3']) {
      assert.equal(parseUsdc(text), null, text);
    }
  });

  it('formats with two decimals, more only when they carry value', () => {
    assert.equal(formatUsdc(175_000_000n), '175.00');
    assert.equal(formatUsdc(175_500_000n), '175.50');
    assert.equal(formatUsdc(1n), '0.000001');
    assert.equal(formatUsdc(0n), '0.00');
  });

  it('splits by basis points rounding down, so parts never exceed the whole', () => {
    const budget = parseUsdc('100')!;
    const parts = [3333, 3333, 3334].map((bps) => shareOf(budget, bps));
    assert.deepEqual(parts.map(formatUsdc), ['33.33', '33.33', '33.34']);
    assert.ok(parts.reduce((a, b) => a + b) <= budget);
    assert.equal(shareOf(1n, 5000), 0n);
  });

  it('formats basis points as a percentage', () => {
    assert.equal(formatPercent(3500), '35%');
    assert.equal(formatPercent(3550), '35.5%');
    assert.equal(formatPercent(1), '0.01%');
  });
});
