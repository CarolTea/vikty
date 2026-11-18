import { Button, type ButtonProps } from '../../components';

type BaseProps = Omit<ButtonProps, 'disabled' | 'reason'>;

/** A Button that is disabled, with its reason right under it, whenever `reason` is set. */
export function GuardedButton({ reason, ...rest }: BaseProps & { reason?: string }) {
  return reason ? <Button {...rest} disabled reason={reason} /> : <Button {...rest} />;
}
