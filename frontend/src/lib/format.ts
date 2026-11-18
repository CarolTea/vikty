import i18n from '../i18n';

const DEFAULT_CURRENCY = 'USDC';

/** Basis points to a percentage string in the current language: 3500 -> "35%". */
export function formatBps(bps: number): string {
  return new Intl.NumberFormat(i18n.language, { style: 'percent', maximumFractionDigits: 2 }).format((bps || 0) / 10000);
}

/** Amount followed by its unit: "175 USDC". Returns null when the value is missing or not a number (never invent one). */
export function formatAmount(value: string | number | null | undefined, currency: string = DEFAULT_CURRENCY): string | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return `${new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 6 }).format(n)} ${currency}`;
}
