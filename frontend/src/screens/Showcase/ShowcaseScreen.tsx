import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AppHeader, AssetCard, BudgetField, Button, Chip, CompositionBar, EmptyState, ErrorState, LoadingState,
  Notice, Page, ProgressSteps, QuoteBlock, StatusPill, ThesisCard, ThesisInput, WeightField, type IconName,
} from '../../components';

const ICON_NAMES: IconName[] = [
  'alert', 'check', 'check-circle', 'info', 'lock', 'undo', 'chevron-down', 'external', 'sparkle', 'search',
  'edit', 'cpu', 'server', 'zap', 'dollar', 'file', 'database', 'shield',
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="vt-stack">
      <h2 className="vt-eyebrow">{title}</h2>
      {children}
    </section>
  );
}

function Variant({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="vt-stack">
      <span className="vt-field-note">{label}</span>
      {children}
    </div>
  );
}

const noop = () => undefined;

export function ShowcaseScreen() {
  const { t } = useTranslation('showcase');
  const s = (key: string) => t(`sections.${key}`);
  const l = (key: string) => t(`labels.${key}`);
  const x = (key: string) => t(`sample.${key}`);
  const seg = (k: string) => x(`segments.${k}`);
  const asset = (k: string) => x(`assets.${k}`);

  const [thesis, setThesis] = useState(x('thesis'));
  const [emptyThesis, setEmptyThesis] = useState('');
  const [budget, setBudget] = useState(x('budget'));
  const [weight, setWeight] = useState(3500);
  const [errWeight, setErrWeight] = useState(12000);
  const [missingWeight, setMissingWeight] = useState(5000);

  const steps = [x('steps.thesis'), x('steps.composition'), x('steps.review'), x('steps.activate')];
  const baseAsset = {
    ticker: asset('solarTicker'), name: asset('solarName'), exposure: asset('solarExposure'), why: asset('solarWhy'),
    risks: [asset('riskVolatility'), asset('riskLiquidity')], weightBps: 3500, amount: '87.5',
  };

  return (
    <Page header={<AppHeader address={l('walletAddress')} />}>
      <header className="vt-stack">
        <h1>{t('pageTitle')}</h1>
        <p>{t('pageIntro')}</p>
      </header>

      <Section title={s('button')}>
        <div className="vt-row">
          <Button variant="primary">{l('primary')}</Button>
          <Button variant="secondary">{l('secondary')}</Button>
          <Button variant="ghost">{l('ghost')}</Button>
          <Button variant="primary" icon="sparkle">{l('withIcon')}</Button>
          <Button variant="primary" disabled reason={l('disabledReason')}>{l('disabled')}</Button>
        </div>
        <Button variant="primary" block>{l('block')}</Button>
      </Section>

      <Section title={s('statusPill')}>
        <div className="vt-row">
          <StatusPill tone="valid">{x('pills.valid')}</StatusPill>
          <StatusPill tone="warning">{x('pills.warning')}</StatusPill>
          <StatusPill tone="danger">{x('pills.danger')}</StatusPill>
          <StatusPill tone="neutral">{x('pills.neutral')}</StatusPill>
          <StatusPill tone="valid" live>{l('live')}</StatusPill>
        </div>
      </Section>

      <Section title={s('chip')}>
        <div className="vt-row">
          <Chip>{x('chips.neutral')}</Chip>
          <Chip tone="available" icon="check">{x('chips.available')}</Chip>
          <Chip tone="warning" icon="alert">{x('chips.warning')}</Chip>
        </div>
      </Section>

      <Section title={s('notice')}>
        <Notice tone="info" title={x('notices.infoTitle')}>{x('notices.infoBody')}</Notice>
        <Notice tone="warning" title={x('notices.warningTitle')}>{x('notices.warningBody')}</Notice>
        <Notice tone="danger" title={x('notices.dangerTitle')}>{x('notices.dangerBody')}</Notice>
        <Notice>{x('notices.noTitle')}</Notice>
      </Section>

      <Section title={s('icon')}>
        <div className="vt-row">
          {ICON_NAMES.map((name) => (
            <Chip key={name} icon={name}>{name}</Chip>
          ))}
        </div>
      </Section>

      <Section title={s('appHeader')}>
        <Variant label={l('connected')}><AppHeader address={l('walletAddress')} /></Variant>
        <Variant label={l('notConnected')}><AppHeader /></Variant>
      </Section>

      <Section title={s('thesisInput')}>
        <Variant label={l('empty')}>
          <ThesisInput value={emptyThesis} onChange={setEmptyThesis} onSubmit={noop} />
        </Variant>
        <Variant label={l('filled')}>
          <ThesisInput value={thesis} onChange={setThesis} onSubmit={noop} />
        </Variant>
        <Variant label={l('busy')}>
          <ThesisInput value={x('thesis')} onChange={noop} onSubmit={noop} busy />
        </Variant>
        <Variant label={l('freeUnavailable')}>
          <ThesisInput value={x('thesis')} onChange={noop} onSubmit={noop} freeInterpretationAvailable={false} />
        </Variant>
      </Section>

      <Section title={s('thesisCard')}>
        <ThesisCard title={x('thesisCardTitle')} summary={x('thesisCardSummary')} />
      </Section>

      <Section title={s('quoteBlock')}>
        <QuoteBlock>{x('thesis')}</QuoteBlock>
      </Section>

      <Section title={s('progressSteps')}>
        <Variant label={l('firstStep')}><ProgressSteps steps={steps} current={0} /></Variant>
        <Variant label={l('middleStep')}><ProgressSteps steps={steps} current={2} /></Variant>
        <Variant label={l('lastStep')}><ProgressSteps steps={steps} current={3} /></Variant>
      </Section>

      <Section title={s('emptyState')}>
        <EmptyState
          title={x('empty.title')}
          description={x('empty.description')}
          thesis={x('thesis')}
          actions={[
            { label: x('empty.primary'), variant: 'primary', icon: 'edit' },
            { label: x('empty.secondary'), variant: 'secondary', icon: 'search' },
          ]}
          footnote={x('empty.footnote')}
        />
      </Section>

      <Section title={s('budgetField')}>
        <BudgetField value={budget} onChange={setBudget} />
      </Section>

      <Section title={s('weightField')}>
        <Variant label={l('normal')}>
          <WeightField weightBps={weight} onChange={setWeight} amount="87.5" />
        </Variant>
        <Variant label={l('error')}>
          <WeightField weightBps={errWeight} onChange={setErrWeight} amount="300" error={x('badWeightError')} />
        </Variant>
        <Variant label={l('missingAmount')}>
          <WeightField weightBps={missingWeight} onChange={setMissingWeight} amount={null} />
        </Variant>
      </Section>

      <Section title={s('compositionBar')}>
        <Variant label={l('exactly100')}>
          <CompositionBar
            segments={[{ label: seg('solar'), bps: 5000 }, { label: seg('wind'), bps: 3000 }, { label: seg('cash'), bps: 2000 }]}
            statusText={x('pills.valid')}
          />
        </Variant>
        <Variant label={l('under100')}>
          <CompositionBar
            segments={[{ label: seg('solar'), bps: 4000 }, { label: seg('wind'), bps: 3000 }]}
            statusText={x('pills.warning')}
          />
        </Variant>
        <Variant label={l('over100')}>
          <CompositionBar
            segments={[{ label: seg('solar'), bps: 6000 }, { label: seg('wind'), bps: 4000 }, { label: seg('cash'), bps: 2000 }]}
            statusText={x('pills.danger')}
          />
        </Variant>
        <Variant label={l('withRejected')}>
          <CompositionBar
            segments={[
              { label: seg('solar'), bps: 6000 }, { label: seg('wind'), bps: 4000 },
              { label: seg('rejected'), bps: 0, rejected: true },
            ]}
            statusText={x('pills.valid')}
          />
        </Variant>
      </Section>

      <Section title={s('assetCard')}>
        <Variant label={l('active')}><AssetCard {...baseAsset} icon="zap" /></Variant>
        <Variant label={l('rejected')}><AssetCard {...baseAsset} state="rejected" /></Variant>
        <Variant label={l('investDisabled')}><AssetCard {...baseAsset} investDisabledReason={asset('disabledReason')} /></Variant>
        <Variant label={l('cash')}>
          <AssetCard
            ticker={asset('cashTicker')} name={asset('cashName')} exposure={asset('cashExposure')}
            weightBps={2000} amount="50" kind="cash" icon="dollar"
          />
        </Variant>
        <Variant label={l('example')}><AssetCard {...baseAsset} example /></Variant>
        <Variant label={l('noBuyRoute')}>
          <AssetCard
            {...baseAsset}
            ticker={asset('windTicker')} name={asset('windName')} exposure={asset('windExposure')} why={asset('windWhy')}
            availability={{ buy: 'no_route' }}
          />
        </Variant>
        <Variant label={l('missingAmount')}><AssetCard {...baseAsset} amount={null} /></Variant>
      </Section>

      <Section title={s('loadingState')}>
        <LoadingState />
        <LoadingState message={x('loading')} />
      </Section>

      <Section title={s('errorState')}>
        <ErrorState message={x('error')} onRetry={noop} />
        <ErrorState message={x('error')} />
      </Section>

      <Section title={s('page')}>
        <Notice>{x('page')}</Notice>
      </Section>
    </Page>
  );
}
