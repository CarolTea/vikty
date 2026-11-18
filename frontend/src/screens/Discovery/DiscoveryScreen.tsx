import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useErrorMessage } from '../../api/errors';
import { useRequest } from '../../api/useRequest';
import {
  AppHeader, ErrorState, LoadingState, Notice, Page, ProgressSteps, ThesisCard, ThesisInput,
} from '../../components';
import { shortAddress, useWallet } from '../../wallet/wallet';
import { routes } from '../routes';

const STEP_KEYS = ['read', 'match', 'prepare'] as const;
const STEP_INTERVAL_MS = 3000;

type Submit = { source: 'free_text'; text: string } | { source: 'suggested'; suggestedThesisId: string };

export function DiscoveryScreen() {
  const { t } = useTranslation('discovery-screen', { keyPrefix: 'discovery' });
  const message = useErrorMessage();
  const navigate = useNavigate();
  const wallet = useWallet();
  const token = wallet.token ?? undefined;

  const session = useRequest('session', () => api.getSession({ token }));
  const theses = useRequest('theses', () => api.listSuggestedTheses());

  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [failure, setFailure] = useState<unknown>(null);
  const [lastSubmit, setLastSubmit] = useState<Submit | null>(null);

  useEffect(() => {
    if (!busy) return undefined;
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, STEP_KEYS.length - 1)), STEP_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [busy]);

  const quotaUsed = !wallet.address && session.status === 'success' && !session.data.anonymous.freeInterpretationAvailable;
  const maxChars = session.status === 'success' ? session.data.limits.convictionMaxChars : undefined;

  async function submit(body: Submit) {
    setBusy(true);
    setStep(0);
    setFailure(null);
    setLastSubmit(body);
    try {
      const result = await api.createInterpretation(body, { token });
      navigate(routes.interpretation(result.id));
    } catch (err) {
      setFailure(err);
      setBusy(false);
    }
  }

  return (
    <Page header={<AppHeader address={wallet.address ? shortAddress(wallet.address) : undefined} onConnect={() => void wallet.connect()} />}>
      <h1>{t('title')}</h1>
      <p>{t('intro')}</p>
      <ThesisInput
        value={text}
        onChange={setText}
        maxChars={maxChars}
        busy={busy}
        freeInterpretationAvailable={!quotaUsed}
        onConnect={() => void wallet.connect()}
        onSubmit={() => void submit({ source: 'free_text', text: text.trim() })}
      />
      {quotaUsed && <Notice tone="info">{t('quotaUsed')}</Notice>}
      {busy && (
        <div className="vt-stack" role="status" aria-live="polite">
          <p>{t('interpreting')}</p>
          <ProgressSteps steps={STEP_KEYS.map((k) => t(`steps.${k}`))} current={step} />
        </div>
      )}
      {failure !== null && !busy && (
        <ErrorState
          title={t('failedTitle')}
          message={message(failure)}
          onRetry={lastSubmit ? () => void submit(lastSubmit) : undefined}
        />
      )}
      <Notice tone="info">{t('limitedUniverse')}</Notice>
      <p>{t('howItWorks')}</p>
      <h2>{t('suggestedTitle')}</h2>
      {theses.status === 'loading' && <LoadingState message={t('suggestedLoading')} />}
      {theses.status === 'error' && <ErrorState message={t('suggestedError')} onRetry={theses.reload} />}
      {theses.status === 'success' && theses.data.items.length === 0 && <p>{t('suggestedEmpty')}</p>}
      {theses.status === 'success' &&
        theses.data.items.map((item) => (
          <ThesisCard key={item.id} title={item.title} summary={item.summary} onUse={() => setText(item.text)} />
        ))}
    </Page>
  );
}
