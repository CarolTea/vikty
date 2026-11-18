import { useTranslation } from 'react-i18next';
import { Button } from '../Button/Button';

export interface ThesisInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  /** Used instead of the interpret button when free interpretation is used up. */
  onConnect?: () => void;
  maxChars?: number;
  freeInterpretationAvailable?: boolean;
  busy?: boolean;
  placeholder?: string;
}

export function ThesisInput({
  value, onChange, onSubmit, onConnect, maxChars = 600, freeInterpretationAvailable = true, busy, placeholder,
}: ThesisInputProps) {
  const { t } = useTranslation('discovery');
  const empty = !value.trim();
  const label = t('thesisInput.interpret');
  const interpret = empty ? (
    <Button variant="primary" icon="sparkle" disabled reason={t('thesisInput.emptyReason')}>{label}</Button>
  ) : busy ? (
    <Button variant="primary" icon="sparkle" disabled reason={t('thesisInput.busyReason')}>{label}</Button>
  ) : (
    <Button variant="primary" icon="sparkle" onClick={onSubmit}>{label}</Button>
  );
  return (
    <div className="vt-glass vt-glass-strong vt-thesis-input">
      <textarea
        aria-label={t('thesisInput.label')}
        maxLength={maxChars}
        rows={3}
        value={value}
        placeholder={placeholder ?? t('thesisInput.placeholder')}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="vt-thesis-side">
        <span className="vt-counter" aria-live="polite">{t('thesisInput.counter', { count: value.length, max: maxChars })}</span>
        {freeInterpretationAvailable ? interpret : (
          <Button variant="primary" onClick={onConnect}>{t('thesisInput.connectToInterpret')}</Button>
        )}
      </div>
    </div>
  );
}
