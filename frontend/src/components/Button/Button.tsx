import { useId, type ReactNode } from 'react';
import { cx, Icon, type IconName } from '../Icon/Icon';

interface BaseProps {
  variant?: 'primary' | 'secondary' | 'ghost';
  icon?: IconName;
  block?: boolean;
  type?: 'button' | 'submit';
  onClick?: () => void;
  className?: string;
  children: ReactNode;
}

/** A disabled button always says why, right under it. */
export type ButtonProps = BaseProps & ({ disabled?: false; reason?: never } | { disabled: true; reason: string });

export function Button({ variant = 'secondary', icon, block, type = 'button', onClick, className, children, ...rest }: ButtonProps) {
  const id = useId();
  const reason = rest.disabled ? rest.reason : undefined;
  const button = (
    <button
      type={type}
      className={cx('vt-btn', `vt-btn-${variant}`, block && 'vt-btn-block', className)}
      disabled={rest.disabled}
      onClick={onClick}
      aria-describedby={reason ? id : undefined}
    >
      {icon && <Icon name={icon} size={18} />}
      <span>{children}</span>
    </button>
  );
  if (!reason) return button;
  return (
    <div className={cx('vt-btn-wrap', block && 'vt-btn-block')}>
      {button}
      <p className="vt-btn-reason" id={id}>{reason}</p>
    </div>
  );
}
