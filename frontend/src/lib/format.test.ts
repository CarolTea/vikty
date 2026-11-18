import { formatAmount, formatBps } from './format';

describe('format', () => {
  it('formats basis points as percent', () => {
    expect(formatBps(3500)).toBe('35%');
    expect(formatBps(1250)).toBe('12.5%');
    expect(formatBps(0)).toBe('0%');
  });
  it('formats amounts with the unit after the number', () => {
    expect(formatAmount('175')).toBe('175 USDC');
    expect(formatAmount(1234.5, 'SOL')).toBe('1,234.5 SOL');
  });
  it('returns null for missing amounts', () => {
    expect(formatAmount(null)).toBeNull();
    expect(formatAmount(undefined)).toBeNull();
    expect(formatAmount('abc')).toBeNull();
  });
});
