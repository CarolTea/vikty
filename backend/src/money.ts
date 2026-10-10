// USDC amounts as bigint micro-units (USDC has 6 decimals). The contract carries money as decimal
// strings and never as floats; this is the only place that converts between the two.

const USDC_DECIMALS = 6;
const SCALE = 10n ** BigInt(USDC_DECIMALS);
const DECIMAL = /^(\d+)(?:\.(\d+))?$/;

export const BPS_TOTAL = 10_000;

// "175.5" → 175_500_000n. Null for anything else: negative, exponent, or more than 6 decimals.
export function parseUsdc(text: string): bigint | null {
  const match = DECIMAL.exec(text);
  if (!match) return null;
  const [, whole, fraction = ''] = match;
  if (fraction.length > USDC_DECIMALS) return null;
  return BigInt(whole!) * SCALE + BigInt(fraction.padEnd(USDC_DECIMALS, '0'));
}

// 175_500_000n → "175.50": at least two decimals, more only when they carry value.
export function formatUsdc(micro: bigint): string {
  const whole = micro / SCALE;
  const fraction = (micro % SCALE).toString().padStart(USDC_DECIMALS, '0').replace(/0+$/, '').padEnd(2, '0');
  return `${whole}.${fraction}`;
}

// The part of `micro` that `bps` stands for, rounded down so the parts never exceed the whole.
export function shareOf(micro: bigint, bps: number): bigint {
  return (micro * BigInt(bps)) / BigInt(BPS_TOTAL);
}

// 3500 → "35%", 3550 → "35.5%".
export function formatPercent(bps: number): string {
  return `${Number((bps / 100).toFixed(2))}%`;
}
