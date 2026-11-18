import { useTranslation } from 'react-i18next';
import { cx } from '../Icon/Icon';
import { StatusPill, type PillTone } from '../StatusPill/StatusPill';
import { formatBps } from '../../lib/format';

export interface Segment {
  label: string;
  bps: number;
  color?: 1 | 2 | 3 | 4;
  rejected?: boolean;
}

export interface CompositionBarProps {
  segments: Segment[];
  status?: 'valid' | 'warning' | 'danger';
  statusText?: string;
}

export function CompositionBar({ segments, status, statusText }: CompositionBarProps) {
  const { t } = useTranslation('composition');
  const total = segments.reduce((sum, s) => sum + (s.bps || 0), 0);
  const tone: PillTone = status ?? (total === 10000 ? 'valid' : total > 10000 ? 'danger' : 'warning');
  const scale = Math.max(total, 10000);
  const barLabel = `${segments.map((s) => `${s.label} ${formatBps(s.bps)}`).join(', ')}; ${t('total')} ${formatBps(total)}`;

  return (
    <section className="vt-composition" aria-label={t('composition')}>
      <div className="vt-composition-head">
        <h3>{t('composition')}</h3>
        <span className={cx('vt-composition-total', tone === 'danger' && 'is-danger', tone === 'warning' && 'is-warning')}>
          {formatBps(total)}
        </span>
      </div>
      <div className="vt-bar" role="img" aria-label={barLabel}>
        {segments.map((s, i) =>
          s.bps > 0 ? (
            // Width is data-driven, the only inline style.
            <span key={i} className={cx('vt-bar-seg', `vt-seg-${s.color ?? i + 1}`)} style={{ width: `${(s.bps / scale) * 100}%` }} />
          ) : null,
        )}
      </div>
      <ul className="vt-legend">
        {segments.map((s, i) => (
          <li key={i}>
            <span className={cx('vt-swatch', `vt-seg-${s.color ?? i + 1}`)} aria-hidden="true" />
            <span>{s.label}</span>
            <span className="vt-num">{s.rejected ? t('rejected') : formatBps(s.bps)}</span>
          </li>
        ))}
      </ul>
      {statusText && <StatusPill tone={tone} live>{statusText}</StatusPill>}
    </section>
  );
}
