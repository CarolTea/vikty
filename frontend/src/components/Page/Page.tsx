import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cx } from '../Icon/Icon';

export interface PageProps {
  header?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** App shell: stage background, optional header, main content and the disclaimer footer. */
export function Page({ header, className, children }: PageProps) {
  const { t } = useTranslation('common');
  return (
    <div className={cx('vt-stage', className)}>
      {header}
      <main className="vt-stack vt-page-main">{children}</main>
      <footer className="vt-page-footer">
        <p>{t('disclaimer')}</p>
      </footer>
    </div>
  );
}
