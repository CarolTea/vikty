import type { components } from '../../api/schema';
import { useTranslation } from 'react-i18next';
import { Button } from '../Button/Button';
import { Chip } from '../Chip/Chip';
import { cx, Icon, type IconName } from '../Icon/Icon';
import { formatAmount, formatBps } from '../../lib/format';

export type AvailabilityState = components['schemas']['AvailabilityState'];

const AVAILABILITY_TONE = { available: 'available', no_route: 'warning', suspended: 'warning', restricted: 'warning', unknown: 'neutral' } as const;
const AVAILABILITY_ICON = { available: 'check', no_route: 'alert', suspended: 'alert', restricted: 'alert', unknown: 'info' } as const;

function AvailabilityChip({ side, state = 'unknown' }: { side: 'buy' | 'sell'; state?: AvailabilityState }) {
  const { t } = useTranslation('composition');
  return <Chip tone={AVAILABILITY_TONE[state]} icon={AVAILABILITY_ICON[state]}>{t(`availability.${side}.${state}`)}</Chip>;
}

export interface AssetCardProps {
  ticker: string;
  name: string;
  exposure: string;
  why?: string;
  risks?: string[];
  /** Missing or `unknown` availability is shown as unknown, never as available. */
  availability?: { buy?: AvailabilityState; sell?: AvailabilityState };
  weightBps: number;
  /** Amount for this weight; null/undefined shows a placeholder instead of an invented number. */
  amount?: string | null;
  currency?: string;
  state?: 'rejected';
  kind?: 'cash';
  /** When set, Invest is disabled and this text explains why. */
  investDisabledReason?: string;
  icon?: IconName;
  example?: boolean;
  onUndo?: () => void;
  onDetails?: () => void;
  onReject?: () => void;
  onInvest?: () => void;
}

export function AssetCard(props: AssetCardProps) {
  const { ticker, name, exposure, why, risks = [], availability = {}, weightBps, amount, currency = 'USDC', kind, investDisabledReason } = props;
  const { t } = useTranslation('composition');
  const rejected = props.state === 'rejected';
  const title = `${ticker} — ${name}`;
  const shownAmount = formatAmount(amount, currency);

  return (
    <article className={cx('vt-asset', rejected && 'vt-asset-rejected')} aria-label={title}>
      <div className="vt-asset-head">
        <span className="vt-tile"><Icon name={props.icon ?? 'sparkle'} size={20} /></span>
        <div className="vt-asset-title">
          <h3>{title}</h3>
          <p>{exposure}</p>
        </div>
        {props.example && <span className="vt-badge">{t('example')}</span>}
      </div>
      {why && (
        <p className="vt-asset-why">
          <span>{t('whyItsHere')}</span>
          {why}
        </p>
      )}
      <div className="vt-row">
        {risks.map((r) => <Chip key={r}>{r}</Chip>)}
      </div>
      <div className="vt-row">
        <AvailabilityChip side="buy" state={availability.buy} />
        <AvailabilityChip side="sell" state={availability.sell} />
      </div>
      {rejected ? (
        <div className="vt-asset-undo">
          <span>{t('rejected')}</span>
          <Button variant="ghost" icon="undo" onClick={props.onUndo}>{t('undo')}</Button>
        </div>
      ) : (
        <div className="vt-asset-foot">
          <div className="vt-asset-weight">
            <strong>{formatBps(weightBps)}</strong>
            <span>{shownAmount ?? t('amountUnavailable')}</span>
          </div>
          <Button variant="ghost" icon="external" onClick={props.onDetails}>{t('details')}</Button>
          {kind !== 'cash' && (
            <div className="vt-asset-actions">
              <Button variant="secondary" onClick={props.onReject}>{t('reject')}</Button>
              {investDisabledReason
                ? <Button variant="primary" disabled reason={investDisabledReason}>{t('invest')}</Button>
                : <Button variant="primary" onClick={props.onInvest}>{t('invest')}</Button>}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
