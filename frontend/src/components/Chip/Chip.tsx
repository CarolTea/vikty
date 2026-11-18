import type { ReactNode } from 'react';
import { cx, Icon, type IconName } from '../Icon/Icon';

export interface ChipProps {
  tone?: 'neutral' | 'available' | 'warning';
  icon?: IconName;
  children?: ReactNode;
}

export function Chip({ tone = 'neutral', icon, children }: ChipProps) {
  return (
    <span className={cx('vt-chip', tone !== 'neutral' && `vt-chip-${tone}`)}>
      {icon && <Icon name={icon} size={14} />}
      {children}
    </span>
  );
}
