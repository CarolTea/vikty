import { useTranslation } from 'react-i18next';
import { Button } from '../Button/Button';
import { Notice } from '../Notice/Notice';

export interface ErrorStateProps {
  /** Already translated description of what went wrong. */
  message: string;
  title?: string;
  onRetry?: () => void;
}

export function ErrorState({ message, title, onRetry }: ErrorStateProps) {
  const { t } = useTranslation('layout');
  return (
    <div className="vt-stack">
      <Notice tone="danger" title={title ?? t('errorTitle')}>{message}</Notice>
      {onRetry && <Button variant="secondary" onClick={onRetry}>{t('retry')}</Button>}
    </div>
  );
}
