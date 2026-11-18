import { useTranslation } from 'react-i18next';
import { Button } from '../Button/Button';
import { Icon, type IconName } from '../Icon/Icon';

export interface ThesisCardProps {
  icon?: IconName;
  title: string;
  summary: string;
  onUse?: () => void;
}

export function ThesisCard({ icon = 'sparkle', title, summary, onUse }: ThesisCardProps) {
  const { t } = useTranslation('discovery');
  return (
    <article className="vt-glass vt-glass-strong vt-thesis-card">
      <div className="vt-thesis-head">
        <span className="vt-tile"><Icon name={icon} size={20} /></span>
        <h3>{title}</h3>
      </div>
      <p>{summary}</p>
      <Button variant="secondary" icon="edit" block onClick={onUse}>{t('thesisCard.use')}</Button>
    </article>
  );
}
