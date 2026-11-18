import type { ReactNode } from 'react';
import { cx, Icon, type IconName } from '../Icon/Icon';

export type NoticeTone = 'info' | 'warning' | 'danger';

export interface NoticeProps {
  tone?: NoticeTone;
  title?: string;
  className?: string;
  children: ReactNode;
}

const NOTICE_ICON: Record<NoticeTone, IconName> = { info: 'info', warning: 'alert', danger: 'alert' };

/** Inline message. Tone is always carried by an icon and words, never color alone; danger is announced. */
export function Notice({ tone = 'info', title, className, children }: NoticeProps) {
  return (
    <div className={cx('vt-notice', `vt-notice-${tone}`, className)} role={tone === 'danger' ? 'alert' : 'note'}>
      <Icon name={NOTICE_ICON[tone]} size={20} />
      <div>
        {title && <strong>{title}</strong>}
        <p>{children}</p>
      </div>
    </div>
  );
}
