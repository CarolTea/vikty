import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Chip, Icon, QuoteBlock, cx, type IconName } from '../../components';
import { formatBps } from '../../lib/format';
import { routes } from '../routes';

interface Item { title: string; body: string }

const PROBLEM_ICONS: IconName[] = ['list', 'help', 'scale'];
const CONTROL_ICONS: IconName[] = ['key', 'hand', 'eye'];
const EXAMPLE_WEIGHTS = [4000, 3500, 2500];
const SECTION_IDS = { how: 'how-it-works', instruments: 'instruments', control: 'control', audience: 'who-its-for' };

/** Public landing page: what VicTy is, before anyone opens the app. */
export function LandingScreen() {
  const { t } = useTranslation('landing');
  const list = <T,>(key: string) => t(key, { returnObjects: true }) as T[];

  return (
    <div className="vt-stage">
      <header className="vt-header">
        <span className="vt-wordmark">{t('common:appName')}</span>
        <nav aria-label={t('nav.label')}>
          <ul className="vt-nav-links">
            <li><a href={`#${SECTION_IDS.how}`}>{t('nav.howItWorks')}</a></li>
            <li><a href={`#${SECTION_IDS.instruments}`}>{t('nav.instruments')}</a></li>
            <li><a href={`#${SECTION_IDS.control}`}>{t('nav.control')}</a></li>
            <li><a href={`#${SECTION_IDS.audience}`}>{t('nav.whoFor')}</a></li>
          </ul>
        </nav>
        <div className="vt-header-actions">
          <Link className="vt-btn vt-btn-secondary vt-btn-sm" to={routes.discovery()}>
            {t('nav.openApp')}
            <Icon name="arrow-right" size={16} />
          </Link>
        </div>
      </header>

      <main className="vt-container">
        <section className="vt-hero vt-split">
          <div className="vt-hero-copy">
            <span className="vt-badge">{t('hero.badge')}</span>
            <h1 className="vt-display">
              {t('hero.titleStart')}
              <br />
              <span className="vt-highlight">{t('hero.titleHighlight')}</span>
            </h1>
            <p className="vt-lead">{t('hero.lead')}</p>
            <div className="vt-row">
              <Link className="vt-btn vt-btn-primary" to={routes.discovery()}>
                {t('hero.start')}
                <Icon name="arrow-right" size={16} />
              </Link>
              <a className="vt-btn vt-btn-ghost" href={`#${SECTION_IDS.how}`}>{t('hero.howItWorks')}</a>
            </div>
            <div className="vt-row">
              <Chip icon="ban">{t('hero.trust.noWallet')}</Chip>
              <Chip>{t('hero.trust.nonCustodial')}</Chip>
              <Chip>{t('hero.trust.youSign')}</Chip>
            </div>
          </div>
          <ExamplePanel />
        </section>

        <section className="vt-section">
          <SectionHead eyebrow={t('problem.eyebrow')} title={t('problem.title')} />
          <div className="vt-grid-3">
            {list<Item>('problem.cards').map((c, i) => (
              <article key={c.title} className="vt-card">
                <span className="vt-tile"><Icon name={PROBLEM_ICONS[i] ?? 'info'} size={16} /></span>
                <h3>{c.title}</h3>
                <p>{c.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="vt-section" id={SECTION_IDS.how}>
          <SectionHead eyebrow={t('how.eyebrow')} title={t('how.title')} lead={t('how.lead')} />
          <ol className="vt-grid-4">
            {list<Item>('how.steps').map((s, i, all) => {
              const last = i === all.length - 1;
              return (
                <li key={s.title} className={cx('vt-card', (i === 1 || i === 2) && 'vt-card-teal')}>
                  <span className="vt-step-num">{String(i + 1).padStart(2, '0')}</span>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                  <span className="vt-card-foot">
                    <Icon name={last ? 'wallet' : 'ban'} size={14} />
                    {last ? t('how.yourWallet') : t('how.noWallet')}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="vt-section vt-split" id={SECTION_IDS.instruments}>
          <div className="vt-section-head">
            <span className="vt-eyebrow">{t('instruments.eyebrow')}</span>
            <h2 className="vt-title">{t('instruments.title')}</h2>
            <p className="vt-lead">{t('instruments.lead')}</p>
            <p className="vt-note">{t('instruments.note')}</p>
          </div>
          <dl className="vt-panel vt-kv">
            {list<{ term: string; value: string }>('instruments.rows').map((r) => (
              <div key={r.term}>
                <dt>{r.term}</dt>
                <dd>{r.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="vt-section" id={SECTION_IDS.control}>
          <SectionHead eyebrow={t('control.eyebrow')} title={t('control.title')} />
          <div className="vt-grid-3">
            {list<Item>('control.cards').map((c, i) => (
              <article key={c.title} className="vt-card vt-card-inline">
                <span className="vt-tile"><Icon name={CONTROL_ICONS[i] ?? 'info'} size={16} /></span>
                <div className="vt-stack">
                  <h3>{c.title}</h3>
                  <p>{c.body}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="vt-section" id={SECTION_IDS.audience}>
          <SectionHead eyebrow={t('audience.eyebrow')} title={t('audience.title')} />
          <div className="vt-grid-2">
            <ListCard icon="check-circle" title={t('audience.needTitle')} items={list<string>('audience.need')} positive />
            <ListCard icon="x-circle" title={t('audience.isntTitle')} items={list<string>('audience.isnt')} />
          </div>
        </section>

        <section className="vt-section">
          <div className="vt-panel vt-cta">
            <h2 className="vt-title-sm">{t('cta.title')}</h2>
            <p className="vt-muted">{t('cta.lead')}</p>
            <Link className="vt-btn vt-btn-primary" to={routes.discovery()}>
              {t('cta.start')}
              <Icon name="arrow-right" size={16} />
            </Link>
          </div>
        </section>
      </main>

      <footer className="vt-page-footer">
        <p>{t('common:disclaimer')}</p>
        <p>{t('footer.network')}</p>
      </footer>
    </div>
  );
}

function SectionHead({ eyebrow, title, lead }: { eyebrow: string; title: string; lead?: string }) {
  return (
    <div className="vt-section-head">
      <span className="vt-eyebrow">{eyebrow}</span>
      <h2 className="vt-title">{title}</h2>
      {lead && <p className="vt-lead">{lead}</p>}
    </div>
  );
}

function ListCard({ icon, title, items, positive }: { icon: IconName; title: string; items: string[]; positive?: boolean }) {
  return (
    <article className="vt-card">
      <h3 className="vt-row">
        <span className={positive ? 'vt-step-done' : 'vt-muted'}><Icon name={icon} size={16} /></span>
        {title}
      </h3>
      <ul className="vt-list">
        {items.map((it) => <li key={it}>{it}</li>)}
      </ul>
    </article>
  );
}

function ExamplePanel() {
  const { t } = useTranslation('landing');
  const exposures = t('example.exposures', { returnObjects: true }) as string[];
  const instruments = t('example.instruments', { returnObjects: true }) as { name: string; exposure: string }[];
  const total = EXAMPLE_WEIGHTS.reduce((a, b) => a + b, 0);

  return (
    <aside className="vt-panel" aria-label={t('example.label')}>
      <div className="vt-row-between">
        <span className="vt-eyebrow">{t('example.label')}</span>
        <Chip>{t('example.disclaimer')}</Chip>
      </div>
      <QuoteBlock>{t('example.thesis')}</QuoteBlock>
      <span className="vt-divider-label">{t('example.understood')}</span>
      <div className="vt-row">
        {exposures.map((e) => <Chip key={e} tone="available">{e}</Chip>)}
        <Chip tone="warning">{t('example.exclusion')}</Chip>
      </div>
      <span className="vt-divider-label">{t('example.represented')}</span>
      <div className="vt-stack">
        {instruments.map((ins, i) => (
          <div key={ins.name} className="vt-instrument-row">
            <span className={cx('vt-instrument-bar', `vt-seg-${i === 1 ? 2 : i === 2 ? 3 : 1}`)} aria-hidden="true" />
            <div>
              <strong>{ins.name}</strong>
              <span>{ins.exposure}</span>
            </div>
            <span className="vt-num">{formatBps(EXAMPLE_WEIGHTS[i] ?? 0)}</span>
          </div>
        ))}
      </div>
      <div className="vt-row-between vt-note">
        <span>{t('example.footer')}</span>
        <span className="vt-num">{t('example.total', { total: formatBps(total) })}</span>
      </div>
    </aside>
  );
}
