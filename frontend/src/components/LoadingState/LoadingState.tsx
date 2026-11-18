import { useTranslation } from 'react-i18next';
import { cx } from '../Icon/Icon';

export interface LoadingStateProps {
  /** Already translated; defaults to the generic loading text. */
  message?: string;
  className?: string;
}

export function LoadingState({ message, className }: LoadingStateProps) {
  const { t } = useTranslation('layout');
  return (
    <div className={cx('vt-glass', 'vt-empty', className)} role="status" aria-live="polite">
      <p>{message ?? t('loading')}</p>
    </div>
  );
}
