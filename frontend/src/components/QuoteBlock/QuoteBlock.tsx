import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export interface QuoteBlockProps {
  children?: ReactNode;
}

/** The user's thesis, quoted back to them. */
export function QuoteBlock({ children }: QuoteBlockProps) {
  const { t } = useTranslation('common');
  return (
    <blockquote className="vt-quote">
      <span className="vt-quote-mark" aria-hidden="true">{t('quoteMark')}</span>
      <span>{children}</span>
    </blockquote>
  );
}
