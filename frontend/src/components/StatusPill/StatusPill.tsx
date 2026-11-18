import type { ReactNode } from 'react';
import { cx, Icon, type IconName } from '../Icon/Icon';

export type PillTone = 'valid' | 'warning' | 'danger' | 'neutral';

export interface StatusPillProps {
  tone?: PillTone;
  /** Announces changes to assistive tech (role="status"). */
  live?: boolean;
  children?: ReactNode;
}

const PILL_ICON: Record<PillTone, IconName> = { valid: 'check-circle', warning: 'alert', danger: 'alert', neutral: 'info' };

export function StatusPill({ tone = 'neutral', live, children }: StatusPillProps) {
  return (
    <span className={cx('vt-pill', `vt-pill-${tone}`)} role={live ? 'status' : undefined}>
      <Icon name={PILL_ICON[tone]} size={18} />
      <span>{children}</span>
    </span>
  );
}
