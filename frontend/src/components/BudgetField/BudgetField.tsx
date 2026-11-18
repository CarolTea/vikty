import { useId } from 'react';
import { useTranslation } from 'react-i18next';

export interface BudgetFieldProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  note?: string;
  currency?: string;
}

/** Planned budget input (controlled). It is a plan, not a balance. */
export function BudgetField({ value, onChange, label, note, currency = 'USDC' }: BudgetFieldProps) {
  const { t } = useTranslation('composition');
  const id = useId();
  return (
    <div className="vt-field">
      <label className="vt-field-label" htmlFor={id}>{label ?? t('plannedBudget')}</label>
      <div className="vt-input vt-input-lg">
        <input id={id} inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} aria-describedby={`${id}-note`} />
        <span className="vt-input-suffix">{currency}</span>
      </div>
      <p className="vt-field-note" id={`${id}-note`}>{note ?? t('budgetNote')}</p>
    </div>
  );
}
