import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Chip, ErrorState, LoadingState, Notice, StatusPill, type PillTone } from '../../components';
import { api } from '../../api/client';
import { useErrorMessage } from '../../api/errors';
import { useRequest } from '../../api/useRequest';

type Status = 'approved' | 'restricted' | 'unavailable';
const STATUS_TONE: Record<Status, PillTone> = { approved: 'valid', restricted: 'warning', unavailable: 'danger' };

function Section({ title, items, children }: { title: string; items?: string[]; children?: ReactNode }) {
  const { t } = useTranslation('composition-screen');
  return (
    <section className="vt-stack">
      <h4>{title}</h4>
      {children}
      {items && (items.length > 0 ? <ul>{items.map((item, i) => <li key={i}>{item}</li>)}</ul> : <p>{t('panel.none')}</p>)}
    </section>
  );
}

export interface InstrumentPanelProps {
  instrumentId: string;
  onClose: () => void;
}

/** Side panel answering "does this token represent what I imagine?" before the decision. */
export function InstrumentPanel({ instrumentId, onClose }: InstrumentPanelProps) {
  const { t, i18n } = useTranslation('composition-screen');
  const errorMessage = useErrorMessage();
  const request = useRequest(`instrument:${instrumentId}`, () => api.getInstrument(instrumentId));
  const date = (value: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value));

  let body: ReactNode;
  if (request.status === 'loading') {
    body = <LoadingState message={t('panel.loading')} />;
  } else if (request.status === 'error') {
    body = <ErrorState message={errorMessage(request.error)} onRetry={request.reload} />;
  } else {
    const d = request.data;
    const status = d.instrument.status;
    const state = (s: string) => t(`panel.availability.${s}`);
    body = (
      <div className="vt-stack">
        <h3>{`${d.instrument.symbol} — ${d.instrument.name}`}</h3>
        <StatusPill tone={STATUS_TONE[status]}>{t(`panel.status.${status}`)}</StatusPill>
        {status !== 'approved' && <Notice tone="warning">{t(`panel.statusNote.${status}`)}</Notice>}
        <Section title={t('panel.represents')}>
          <p>{d.represents}</p>
        </Section>
        <Section title={t('panel.issuer')}>
          <p>{d.issuer.name}</p>
          <p>{t('panel.issuerNature', { nature: d.issuer.nature })}</p>
        </Section>
        <Section title={t('panel.rights')} items={d.economicRights} />
        <Section title={t('panel.limitations')} items={d.limitations} />
        <Section title={t('panel.risks')} items={d.risks} />
        <Section title={t('panel.costs')} items={d.costs} />
        <Section title={t('panel.trading')}>
          <p>{d.howToTrade}</p>
          <div className="vt-row">
            <Chip tone={d.availability.buy === 'available' ? 'available' : 'warning'}>
              {t('panel.buy', { state: state(d.availability.buy) })}
            </Chip>
            <Chip tone={d.availability.sell === 'available' ? 'available' : 'warning'}>
              {t('panel.sell', { state: state(d.availability.sell) })}
            </Chip>
          </div>
        </Section>
        <Section title={t('panel.sources')}>
          <ul>
            {d.evidence.map((e) => (
              <li key={e.url}>
                <a href={e.url} target="_blank" rel="noreferrer">{e.label}</a>
                {' '}
                <span>{t('panel.reviewed', { date: date(e.reviewedAt) })}</span>
              </li>
            ))}
          </ul>
        </Section>
        {d.eligibilityNotes.length > 0 && <Section title={t('panel.eligibility')} items={d.eligibilityNotes} />}
      </div>
    );
  }

  return (
    <aside className="vt-glass vt-stack" aria-label={t('panel.title')}>
      <div className="vt-row">
        <h2>{t('panel.title')}</h2>
        <Button variant="ghost" onClick={onClose}>{t('panel.close')}</Button>
      </div>
      {body}
    </aside>
  );
}
