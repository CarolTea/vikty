import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cx, Icon } from '../Icon/Icon';
import { formatAmount } from '../../lib/format';

export interface WeightFieldProps {
  weightBps: number;
  onChange: (bps: number) => void;
  /** Amount for this weight; null/undefined shows a placeholder instead of an invented number. */
  amount?: string | null;
  currency?: string;
  error?: string;
}

const toText = (bps: number) => String(bps / 100);

/** Weight input in percent (controlled by basis points). */
export function WeightField({ weightBps, onChange, amount, currency = 'USDC', error }: WeightFieldProps) {
  const { t } = useTranslation('composition');
  const id = useId();
  // Local text only keeps partial typing ("12.") intact; the parent's weightBps stays the source of truth.
  const [text, setText] = useState(toText(weightBps));
  const [syncedBps, setSyncedBps] = useState(weightBps);
  if (syncedBps !== weightBps) {
    // The parent changed the weight: resync during render unless the text already says the same.
    setSyncedBps(weightBps);
    if (Math.round(Number(text.replace(',', '.')) * 100) !== weightBps) setText(toText(weightBps));
  }

  const handle = (next: string) => {
    setText(next);
    const n = Number(next.replace(',', '.'));
    if (next.trim() !== '' && Number.isFinite(n)) onChange(Math.round(n * 100));
  };
  const shown = formatAmount(amount, currency);

  return (
    <div className="vt-field">
      <label className="vt-field-label" htmlFor={id}>{t('weight')}</label>
      <div className="vt-weight">
        <div className={cx('vt-input', !!error && 'vt-input-invalid')}>
          <input
            id={id}
            inputMode="decimal"
            value={text}
            onChange={(e) => handle(e.target.value)}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? `${id}-err` : undefined}
          />
          <span className="vt-input-suffix">%</span>
        </div>
        <span className="vt-weight-amount">{shown ?? t('amountMissing')}</span>
      </div>
      {error && (
        <p className="vt-field-error" id={`${id}-err`}>
          <Icon name="alert" size={16} />
          {error}
        </p>
      )}
    </div>
  );
}
