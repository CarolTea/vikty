import { useTranslation } from 'react-i18next';
import { cx, Icon } from '../Icon/Icon';

export interface ProgressStepsProps {
  /** Already-translated step labels. */
  steps: string[];
  /** Zero-based index of the step in progress. */
  current: number;
}

export function ProgressSteps({ steps, current }: ProgressStepsProps) {
  const { t } = useTranslation('discovery');
  return (
    <ol className="vt-steps">
      {steps.map((label, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'pending';
        const text = t('steps.label', { index: i + 1, label });
        return (
          // The state is announced through aria-label: the design system has no visually-hidden class.
          <li
            key={label}
            className={cx('vt-step', `vt-step-${state}`)}
            aria-current={state === 'current' ? 'step' : undefined}
            aria-label={t('steps.withState', { label: text, state: t(`steps.${state}`) })}
          >
            <span className="vt-step-dot">{state === 'done' && <Icon name="check" size={16} />}</span>
            <span>{text}</span>
          </li>
        );
      })}
    </ol>
  );
}
