import { useTranslation } from 'react-i18next';
import { formatAmount } from '../../lib/format';
import { NS } from './types';

/** Formats "value unit", or says it is not available: a missing number is never replaced by a guess. */
export function useAmount() {
  const { t } = useTranslation(NS);
  return (value: string | number | null | undefined, symbol?: string | null): string =>
    formatAmount(value, symbol || undefined) ?? t('unavailable');
}

/** The part of `planned` that fits in `available`; keeps the planned text when it already fits. */
export function limitAmount(planned: string, available: number): { amount: string; limited: boolean } {
  const wanted = Number(planned);
  if (!Number.isFinite(wanted) || wanted <= available) return { amount: planned, limited: false };
  return { amount: String(Math.floor(available * 1e6) / 1e6), limited: true };
}
