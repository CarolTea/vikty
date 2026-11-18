import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { api, type Api } from '../../api/client';
import { useErrorMessage } from '../../api/errors';
import { useRequest } from '../../api/useRequest';
import {
  AppHeader, Button, Chip, EmptyState, ErrorState, LoadingState, Notice, Page, QuoteBlock,
} from '../../components';
import { shortAddress, useWallet } from '../../wallet/wallet';
import { routes } from '../routes';

type Interpretation = Awaited<ReturnType<Api['getInterpretation']>>;
type Patch = Parameters<Api['updateInterpretation']>[1];
type Item = Interpretation['exposures'][number];

/** The composition needs a planned amount; the user adjusts it on the next screen. */
const STARTING_BUDGET_USDC = '100.00';

export function InterpretationScreen() {
  const { id = '' } = useParams();
  return <InterpretationView key={id} id={id} />;
}

function InterpretationView({ id }: { id: string }) {
  const { t } = useTranslation('discovery-screen', { keyPrefix: 'interpretation' });
  const message = useErrorMessage();
  const navigate = useNavigate();
  const wallet = useWallet();
  const token = wallet.token ?? undefined;
  const loaded = useRequest(id, () => api.getInterpretation(id, { token }));

  const [updated, setUpdated] = useState<Interpretation | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState<{ title: string; error: unknown } | null>(null);

  const header = (
    <AppHeader address={wallet.address ? shortAddress(wallet.address) : undefined} onConnect={() => void wallet.connect()} />
  );
  const back = () => navigate(routes.discovery());

  if (loaded.status === 'loading') {
    return <Page header={header}><LoadingState message={t('loading')} /></Page>;
  }
  if (loaded.status === 'error') {
    return (
      <Page header={header}>
        <ErrorState title={t('loadFailedTitle')} message={message(loaded.error)} onRetry={loaded.reload} />
        <Button variant="ghost" onClick={back}>{t('back')}</Button>
      </Page>
    );
  }
  const data = updated ?? loaded.data;

  async function patch(body: Patch) {
    setSaving(true);
    setFailure(null);
    try {
      setUpdated(await api.updateInterpretation(id, body, { token }));
    } catch (error) {
      setFailure({ title: t('updateFailedTitle'), error });
    } finally {
      setSaving(false);
    }
  }

  async function confirm() {
    setConfirming(true);
    setFailure(null);
    try {
      const proposal = await api.createProposal({ interpretationId: data.id, budgetUsdc: STARTING_BUDGET_USDC }, { token });
      navigate(routes.composition(proposal.id));
    } catch (error) {
      setFailure({ title: t('confirmFailedTitle'), error });
      setConfirming(false);
    }
  }

  if (data.representation === 'insufficient') {
    return (
      <Page header={header}>
        <EmptyState
          title={t('insufficientTitle')}
          description={t('insufficientDescription')}
          thesis={data.summary}
          actions={[{ label: t('insufficientAction'), variant: 'primary', icon: 'search', onClick: back }]}
          footnote={t('insufficientFootnote')}
        />
        {data.limitations.length > 0 && <Notice tone="warning" title={t('limitations')}>{data.limitations.join(' ')}</Notice>}
      </Page>
    );
  }

  const blocked = data.status !== 'ready' || data.ambiguities.some((a) => a.material && a.answer === null);

  return (
    <Page header={header}>
      <h1>{t('title')}</h1>
      {data.curated && (
        <div className="vt-row">
          <Chip tone="available" icon="check-circle">{t('curated')}</Chip>
          <span>{t('curatedNote')}</span>
        </div>
      )}
      <section className="vt-stack" aria-label={t('conviction')}>
        <span className="vt-eyebrow">{t('conviction')}</span>
        <QuoteBlock>{data.summary}</QuoteBlock>
      </section>
      {data.representation === 'partial' && <Notice tone="warning">{t('partial')}</Notice>}
      <ItemBlock
        title={t('exposures')}
        items={data.exposures}
        disabled={saving}
        onRemove={(itemId) => void patch({ removeExposureIds: [itemId] })}
      />
      <ItemBlock
        title={t('exclusions')}
        items={data.exclusions}
        disabled={saving}
        addLabel={t('addExclusion')}
        onAdd={(value) => void patch({ addExclusions: [value] })}
        onRemove={(itemId) => void patch({ removeExclusionIds: [itemId] })}
      />
      <ItemBlock
        title={t('restrictions')}
        items={data.restrictions}
        disabled={saving}
        addLabel={t('addRestriction')}
        onAdd={(value) => void patch({ addRestrictions: [value] })}
        onRemove={(itemId) => void patch({ removeRestrictionIds: [itemId] })}
      />
      {data.ambiguities.map((a) => (
        <section key={a.id} className="vt-glass vt-stack" aria-label={a.question}>
          <span className="vt-eyebrow">{t('ambiguities')}</span>
          <h2>{a.question}</h2>
          <div className="vt-row">
            {a.options.map((o) => (
              <Button
                key={o.id}
                variant={a.answer === o.id ? 'primary' : 'secondary'}
                icon={a.answer === o.id ? 'check' : undefined}
                onClick={() => void patch({ answers: [{ ambiguityId: a.id, optionId: o.id }] })}
              >
                {o.label}
              </Button>
            ))}
          </div>
          <Chip tone={a.answer === null ? 'warning' : 'available'}>{a.answer === null ? t('needsAnswer') : t('answered')}</Chip>
        </section>
      ))}
      {data.limitations.length > 0 && <Notice tone="warning" title={t('limitations')}>{data.limitations.join(' ')}</Notice>}
      {saving && <p role="status">{t('saving')}</p>}
      {failure && <ErrorState title={failure.title} message={message(failure.error)} />}
      <div className="vt-row">
        {blocked ? (
          <Button variant="primary" disabled reason={t('blockedReason')}>{t('confirm')}</Button>
        ) : confirming ? (
          <Button variant="primary" disabled reason={t('confirming')}>{t('confirm')}</Button>
        ) : (
          <Button variant="primary" onClick={() => void confirm()}>{t('confirm')}</Button>
        )}
        <Button variant="ghost" onClick={back}>{t('back')}</Button>
      </div>
    </Page>
  );
}

interface ItemBlockProps {
  title: string;
  items: Item[];
  disabled: boolean;
  onRemove: (id: string) => void;
  addLabel?: string;
  onAdd?: (value: string) => void;
}

/** One correctable block: its items with a remove action each, and an optional add field. */
function ItemBlock({ title, items, disabled, onRemove, addLabel, onAdd }: ItemBlockProps) {
  const { t } = useTranslation('discovery-screen', { keyPrefix: 'interpretation' });
  const inputId = useId();
  const [draft, setDraft] = useState('');
  const canAdd = draft.trim() !== '' && !disabled;
  return (
    <section className="vt-glass vt-stack" aria-label={title}>
      <h2>{title}</h2>
      {items.length === 0 && <p>{t('none')}</p>}
      <ul className="vt-stack">
        {items.map((item) => (
          <li key={item.id} className="vt-row">
            <Chip>{item.label}</Chip>
            {disabled ? (
              <Button variant="ghost" disabled reason={t('saving')}>{t('removeItem', { label: item.label })}</Button>
            ) : (
              <Button variant="ghost" onClick={() => onRemove(item.id)}>{t('removeItem', { label: item.label })}</Button>
            )}
          </li>
        ))}
      </ul>
      {onAdd && addLabel && (
        <div className="vt-field">
          <label className="vt-field-label" htmlFor={inputId}>{addLabel}</label>
          <div className="vt-row">
            <div className="vt-input">
              <input id={inputId} value={draft} onChange={(e) => setDraft(e.target.value)} />
            </div>
            {canAdd ? (
              <Button
                variant="secondary"
                onClick={() => {
                  onAdd(draft.trim());
                  setDraft('');
                }}
              >
                {t('addLabel')}
              </Button>
            ) : (
              <Button variant="secondary" disabled reason={disabled ? t('saving') : t('addReason')}>{t('addLabel')}</Button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
