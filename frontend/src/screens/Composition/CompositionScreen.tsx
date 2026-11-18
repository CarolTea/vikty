import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AppHeader,
  BudgetField,
  Button,
  CompositionBar,
  ErrorState,
  LoadingState,
  Notice,
  Page,
  type Segment,
} from '../../components';
import { api, type Api } from '../../api/client';
import { useErrorMessage } from '../../api/errors';
import { useRequest } from '../../api/useRequest';
import { shortAddress, useWallet } from '../../wallet/wallet';
import { routes } from '../routes';
import { AssetEntry, type ProposalItem } from './AssetEntry';
import { InstrumentPanel } from './InstrumentPanel';

type Proposal = Awaited<ReturnType<Api['getProposal']>>;
type Validation = Proposal['validation'];

interface Outcome {
  key: string;
  validation?: Validation;
  items?: ProposalItem[];
  failed?: boolean;
}

const VALIDATION_DELAY_MS = 300;
const BAR_COLORS = [1, 2, 3, 4] as const;
const isPositiveNumber = (text: string) => text.trim() !== '' && Number.isFinite(Number(text)) && Number(text) > 0;

/** Loads the proposal named in the URL; the editable draft lives below, in component state. */
export function CompositionScreen() {
  const { id = '' } = useParams();
  const { t } = useTranslation('composition-screen');
  const errorMessage = useErrorMessage();
  const wallet = useWallet();
  const request = useRequest(`proposal:${id}`, () => api.getProposal(id));

  const header = (
    <AppHeader address={wallet.address ? shortAddress(wallet.address) : undefined} onConnect={() => void wallet.connect()} />
  );
  if (request.status === 'loading') {
    return <Page header={header}><LoadingState /></Page>;
  }
  if (request.status === 'error') {
    return <Page header={header}><ErrorState message={errorMessage(request.error)} onRetry={request.reload} /></Page>;
  }
  return (
    <Page header={header}>
      <h1>{t('title')}</h1>
      <p>{t('intro')}</p>
      <Workspace key={request.data.id} proposal={request.data} />
    </Page>
  );
}

function Workspace({ proposal }: { proposal: Proposal }) {
  const { t } = useTranslation('composition-screen');
  const errorMessage = useErrorMessage();
  const wallet = useWallet();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const openInstrument = searchParams.get('instrument');

  // Draft: edits stay here and are checked by the server; nothing is stored in the browser.
  const [budget, setBudget] = useState(proposal.budgetUsdc);
  const [weights, setWeights] = useState<Record<string, number>>(() =>
    Object.fromEntries(proposal.items.map((i) => [i.instrument.id, i.weightBps])),
  );
  const [rejected, setRejected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(proposal.items.map((i) => [i.instrument.id, i.state === 'rejected'])),
  );

  const budgetOk = isPositiveNumber(budget);
  const draftKey = (b: string, w: typeof weights, r: typeof rejected) =>
    JSON.stringify({
      budgetUsdc: b,
      items: proposal.items.map((i) => {
        const itemId = i.instrument.id;
        const isRejected = !!r[itemId];
        return { instrumentId: itemId, weightBps: isRejected ? 0 : (w[itemId] ?? 0), state: isRejected ? 'rejected' : 'active' };
      }),
    });
  const [initialKey] = useState(() => draftKey(proposal.budgetUsdc, weights, rejected));
  const key = draftKey(budget, weights, rejected);

  const [outcome, setOutcome] = useState<Outcome | null>(null);
  useEffect(() => {
    if (key === initialKey || !isPositiveNumber((JSON.parse(key) as { budgetUsdc: string }).budgetUsdc)) return;
    let active = true;
    const timer = setTimeout(() => {
      api.createProposalValidation(proposal.id, JSON.parse(key) as Parameters<Api['createProposalValidation']>[1]).then(
        (r) => active && setOutcome({ key, validation: r.validation, items: r.items }),
        () => active && setOutcome({ key, failed: true }),
      );
    }, VALIDATION_DELAY_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [key, initialKey, proposal.id]);

  // What the server last said about exactly this draft; null while a new check is pending.
  const settled: Outcome | null = key === initialKey ? { key, validation: proposal.validation, items: proposal.items } : outcome?.key === key ? outcome : null;
  const validation = settled?.validation;
  const checking = budgetOk && !settled;
  const failed = !!settled?.failed;

  const availabilityOf = (item: ProposalItem) =>
    (settled?.items?.find((x) => x.instrument.id === item.instrument.id) ?? item).availability;
  const amountOf = (item: ProposalItem) =>
    settled?.items?.find((x) => x.instrument.id === item.instrument.id)?.plannedUsdc ?? null;

  const globalReason = !budgetOk
    ? t('invest.budget')
    : checking
      ? t('invest.validating')
      : failed || (validation && !validation.conclusive)
        ? t('invest.inconclusive')
        : validation && !validation.valid
          ? t('invest.invalid')
          : undefined;

  // --- actions that leave the screen ---
  const [working, setWorking] = useState<'invest' | 'proposal' | null>(null);
  const [actionError, setActionError] = useState<{ title: string; message: string } | null>(null);
  const [pendingInvest, setPendingInvest] = useState(false);

  const createPlan = async () => {
    setPendingInvest(false);
    setWorking('invest');
    try {
      const body = JSON.parse(key) as Omit<Parameters<Api['createPlan']>[0], 'proposalId'>;
      const plan = await api.createPlan(
        { proposalId: proposal.id, budgetUsdc: body.budgetUsdc, items: body.items },
        { token: wallet.token ?? undefined },
      );
      navigate(routes.activatePlan(plan.id));
    } catch (err) {
      setActionError({ title: t('invest.failedTitle'), message: errorMessage(err) });
      setWorking(null);
    }
  };
  const createPlanRef = useRef(createPlan);
  useEffect(() => {
    createPlanRef.current = createPlan;
  });
  // After connecting, continue with the Invest the user asked for.
  useEffect(() => {
    if (pendingInvest && wallet.address && wallet.token) {
      void createPlanRef.current();
    }
  }, [pendingInvest, wallet.address, wallet.token]);

  const invest = async () => {
    setActionError(null);
    if (wallet.address && wallet.token) {
      await createPlan();
      return;
    }
    setPendingInvest(true);
    try {
      await wallet.connect();
    } catch (err) {
      setActionError({ title: t('invest.failedTitle'), message: errorMessage(err) });
    }
  };

  const askNewProposal = async () => {
    setActionError(null);
    setWorking('proposal');
    try {
      const next = await api.createProposal({ interpretationId: proposal.interpretationId, budgetUsdc: budget });
      navigate(routes.composition(next.id));
    } catch (err) {
      setActionError({ title: t('newProposal.failedTitle'), message: errorMessage(err) });
      setWorking(null);
    }
  };

  // --- summary ---
  const segments: Segment[] = proposal.items.map((i, idx) => ({
    label: i.instrument.symbol,
    bps: rejected[i.instrument.id] ? 0 : (weights[i.instrument.id] ?? 0),
    color: BAR_COLORS[idx % BAR_COLORS.length],
    rejected: !!rejected[i.instrument.id],
  }));
  const nameOf = (instrumentId: string | null) =>
    proposal.items.find((i) => i.instrument.id === instrumentId)?.instrument.symbol ?? t('issues.general');

  let status: 'valid' | 'warning' | 'danger' = 'warning';
  let statusText = t('summary.statusChecking');
  if (!budgetOk) statusText = t('summary.statusBudget');
  else if (settled && (failed || !validation?.conclusive)) statusText = t('summary.statusInconclusive');
  else if (validation && !validation.valid) {
    status = 'danger';
    statusText = t('summary.statusInvalid');
  } else if (validation) {
    status = 'valid';
    statusText = t('summary.statusValid');
  }
  const hasRejected = Object.values(rejected).some(Boolean);

  return (
    <>
      <section className="vt-glass vt-stack" aria-label={t('summary.title')}>
        <BudgetField value={budget} onChange={setBudget} />
        <CompositionBar segments={segments} status={status} statusText={statusText} />
        {failed && <Notice tone="warning">{t('notices.validationFailed')}</Notice>}
        {settled && !failed && validation && !validation.conclusive && (
          <Notice tone="warning">{t('notices.inconclusive')}</Notice>
        )}
        {settled && !failed && validation?.issues.map((issue, i) => (
          <Notice key={i} tone={issue.severity === 'error' ? 'danger' : 'warning'}>
            {t(`issues.${issue.code}`, { name: nameOf(issue.instrumentId), defaultValue: issue.message })}
          </Notice>
        ))}
        {hasRejected && <Notice title={t('notices.rejectedTitle')}>{t('notices.rejected')}</Notice>}
        {proposal.limitations.map((text, i) => (
          <Notice key={text} title={i === 0 ? t('notices.limitationsTitle') : undefined}>{text}</Notice>
        ))}
        {actionError && <Notice tone="danger" title={actionError.title}>{actionError.message}</Notice>}
        {working === 'proposal' ? (
          <Button variant="secondary" disabled reason={t('newProposal.working')}>{t('newProposal.action')}</Button>
        ) : (
          <Button variant="secondary" onClick={() => void askNewProposal()}>{t('newProposal.action')}</Button>
        )}
        <p>{t('newProposal.hint')}</p>
      </section>

      <section className="vt-stack">
        {proposal.items.map((item) => {
          const itemId = item.instrument.id;
          const live = { ...item, availability: availabilityOf(item) };
          return (
            <AssetEntry
              key={itemId}
              item={live}
              weightBps={weights[itemId] ?? 0}
              rejected={!!rejected[itemId]}
              amount={amountOf(item)}
              investDisabledReason={working === 'invest' ? t('invest.working') : globalReason}
              onWeightChange={(bps) => setWeights((w) => ({ ...w, [itemId]: bps }))}
              onReject={() => setRejected((r) => ({ ...r, [itemId]: true }))}
              onUndo={() => setRejected((r) => ({ ...r, [itemId]: false }))}
              onDetails={() => navigate(routes.instrument(proposal.id, itemId))}
              onInvest={() => void invest()}
            />
          );
        })}
      </section>

      {openInstrument && (
        <InstrumentPanel instrumentId={openInstrument} onClose={() => navigate(routes.composition(proposal.id))} />
      )}
    </>
  );
}
