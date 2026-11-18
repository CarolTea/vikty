import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, type ButtonProps } from '../Button/Button';
import { Icon, type IconName } from '../Icon/Icon';
import { QuoteBlock } from '../QuoteBlock/QuoteBlock';

export interface EmptyStateAction {
  label: string;
  variant?: ButtonProps['variant'];
  icon?: IconName;
  onClick?: () => void;
}

export interface EmptyStateProps {
  icon?: IconName;
  title: string;
  description?: string;
  /** The user's thesis, quoted under the description. */
  thesis?: string;
  actions?: EmptyStateAction[];
  footnote?: string;
}

export function EmptyState({ icon = 'alert', title, description, thesis, actions, footnote }: EmptyStateProps) {
  const id = useId();
  const { t } = useTranslation('discovery');
  return (
    <section className="vt-glass vt-empty" aria-labelledby={id}>
      <span className="vt-empty-icon"><Icon name={icon} size={32} /></span>
      <h2 id={id}>{title}</h2>
      {description && <p>{description}</p>}
      {thesis && (
        <>
          <span className="vt-eyebrow">{t('empty.yourThesis')}</span>
          <QuoteBlock>{thesis}</QuoteBlock>
        </>
      )}
      {actions && (
        <div className="vt-empty-actions">
          {actions.map((a) => (
            <Button key={a.label} variant={a.variant} icon={a.icon} onClick={a.onClick}>{a.label}</Button>
          ))}
        </div>
      )}
      {footnote && (
        <div className="vt-footnote"><Icon name="info" size={20} /><span>{footnote}</span></div>
      )}
    </section>
  );
}
