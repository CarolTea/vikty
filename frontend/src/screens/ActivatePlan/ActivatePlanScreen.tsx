import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import { useErrorMessage } from '../../api/errors';
import { useRequest } from '../../api/useRequest';
import { ApiError } from '../../api/transport';
import { Button, ErrorState, LoadingState, Notice } from '../../components';
import { shortAddress } from '../../wallet/wallet';
import { DetailRow } from '../purchase-shared/DetailRow';
import { GuardedButton } from '../purchase-shared/GuardedButton';
import { PurchaseFrame } from '../purchase-shared/PurchaseFrame';
import { NS, type Balances, type Plan } from '../purchase-shared/types';
import { limitAmount, useAmount } from '../purchase-shared/useAmount';
import { useConnectedWallet } from '../purchase-shared/useConnectedWallet';
import { useGuardedAction } from '../purchase-shared/useGuardedAction';
import { useIntentKey } from '../purchase-shared/useIntentKey';
import { WalletChangedNotice } from '../purchase-shared/WalletChangedNotice';
import { routes } from '../routes';

const CASH_SYMBOL = 'USDC';

export function ActivatePlanScreen() {
  const { t } = useTranslation(NS);
  return (
    <PurchaseFrame title={t('activate.title')} subtitle={t('activate.subtitle')}>
      <ActivatePlanContent />
    </PurchaseFrame>
  );
}

function ActivatePlanContent() {
  const { t } = useTranslation(NS);
  const { id = '' } = useParams();
  const { address, token } = useConnectedWallet();
  const message = useErrorMessage();
  const plan = useRequest(`plan:${id}`, () => api.getPlan(id, { token }));
  const balances = useRequest(`balances:${address}`, () => api.getWalletBalances({ token }));

  if (plan.status === 'error') return <ErrorState message={message(plan.error)} onRetry={plan.reload} />;
  if (balances.status === 'error') return <ErrorState message={message(balances.error)} onRetry={balances.reload} />;
  if (plan.status === 'loading' || balances.status === 'loading') return <LoadingState message={t('activate.loading')} />;
  return <ActivateForm plan={plan.data} balances={balances.data} />;
}

function ActivateForm({ plan, balances }: { plan: Plan; balances: Balances }) {
  const { t } = useTranslation(NS);
  const navigate = useNavigate();
  const { address, token } = useConnectedWallet();
  const message = useErrorMessage();
  const amount = useAmount();
  const { busy, run } = useGuardedAction();
  const { keyFor, release } = useIntentKey();

  const [activated, setActivated] = useState<Plan | null>(null);
  const current = activated ?? plan;
  const isActive = current.status === 'active';

  const items = current.items.filter((i) => i.state === 'active' && i.instrument.kind === 'token');
  const [selected, setSelected] = useState<string[]>(() =>
    plan.trackedMints.length > 0 ? plan.trackedMints : items.map((i) => i.instrument.mint),
  );
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<unknown>(undefined);
  const [preparingId, setPreparingId] = useState<string | null>(null);

  const balanceOf = (mint: string) => balances.tokens.find((tk) => tk.mint === mint);
  const usdc = balances.tokens.find((tk) => tk.symbol === CASH_SYMBOL);
  const available = usdc ? Number(usdc.quantity) : 0;
  const budget = Number(plan.budgetUsdc);
  const reserve = Number(balances.sol.suggestedFeeReserve);
  const solQuantity = Number(balances.sol.quantity);
  const hasFunds = Number.isFinite(available) && available > 0;
  const walletChanged = balances.wallet !== address;
  const preexisting = selected.filter((mint) => Number(balanceOf(mint)?.quantity ?? 0) > 0);

  const toggle = (mint: string) =>
    setSelected((s) => (s.includes(mint) ? s.filter((m) => m !== mint) : [...s, mint]));

  const activateReason = walletChanged
    ? t('activate.walletReason')
    : selected.length === 0
      ? t('activate.noScopeReason')
      : preexisting.length > 0 && !confirmed
        ? t('activate.needConfirmReason')
        : busy
          ? t('actions.working')
          : undefined;

  const activate = () =>
    run(async () => {
      setError(undefined);
      try {
        const updated = await api.activatePlan(
          plan.id,
          { status: 'active', trackedMints: selected, confirmPreexistingBalances: preexisting.length === 0 || confirmed },
          { token },
        );
        setActivated(updated);
      } catch (e) {
        setError(e);
      }
    });

  const invest = (instrumentId: string, inputUsdc: string) =>
    run(async () => {
      setError(undefined);
      setPreparingId(instrumentId);
      try {
        const intent = `${plan.id}:${instrumentId}:${inputUsdc}`;
        const operation = await api.prepareOperation(
          { planId: plan.id, side: 'buy', instrumentId, inputUsdc },
          keyFor(intent),
          { token },
        );
        release(intent);
        navigate(routes.purchaseReview(operation.id));
      } catch (e) {
        setError(e);
      } finally {
        setPreparingId(null);
      }
    });

  const inProgressId =
    error instanceof ApiError && error.code === 'OPERATION_IN_PROGRESS' && typeof error.details?.operationId === 'string'
      ? error.details.operationId
      : undefined;

  return (
    <div className="vt-stack">
      {walletChanged && (
        <WalletChangedNotice
          expected={balances.wallet}
          current={address}
          body={t('activate.walletMismatchBody', { expected: shortAddress(balances.wallet), current: shortAddress(address) })}
        />
      )}

      <section className="vt-asset" aria-labelledby="balances-title">
        <h2 id="balances-title">{t('activate.balancesTitle')}</h2>
        <DetailRow label={t('activate.sol')}>{amount(balances.sol.quantity, 'SOL')}</DetailRow>
        <DetailRow label={t('activate.usdc')}>{usdc ? amount(usdc.quantity, CASH_SYMBOL) : amount(0, CASH_SYMBOL)}</DetailRow>
        <p className="vt-field-note">{t('activate.reserveNote', { reserve: balances.sol.suggestedFeeReserve })}</p>
        {Number.isFinite(solQuantity) && Number.isFinite(reserve) && solQuantity < reserve && (
          <Notice tone="warning" title={t('activate.reserveLowTitle')}>
            {t('activate.reserveLowBody', { quantity: balances.sol.quantity, reserve: balances.sol.suggestedFeeReserve })}
          </Notice>
        )}
      </section>

      <section className="vt-asset" aria-labelledby="budget-title">
        <h2 id="budget-title">{t('activate.budgetTitle')}</h2>
        <DetailRow label={t('activate.plannedBudget')}>{amount(plan.budgetUsdc, CASH_SYMBOL)}</DetailRow>
        <DetailRow label={t('activate.availableFunds')}>{amount(available, CASH_SYMBOL)}</DetailRow>
        {!hasFunds && (
          <Notice tone="warning" title={t('activate.noUsdcTitle')}>{t('activate.noUsdcBody')}</Notice>
        )}
        {hasFunds && Number.isFinite(budget) && budget > available && (
          <Notice tone="info" title={t('activate.overBudgetTitle')}>
            {t('activate.overBudgetBody', { budget: amount(plan.budgetUsdc, CASH_SYMBOL), available: amount(available, CASH_SYMBOL) })}
          </Notice>
        )}
      </section>

      <section className="vt-asset" aria-labelledby="scope-title">
        <h2 id="scope-title">{t('activate.scopeTitle')}</h2>
        <p className="vt-field-note">{isActive ? t('activate.scopeLocked') : t('activate.scopeIntro')}</p>
        <ul className="vt-stack">
          {items.map(({ instrument }) => {
            const held = balanceOf(instrument.mint);
            const hasHeld = Number(held?.quantity ?? 0) > 0;
            return (
              <li key={instrument.id} className="vt-stack">
                <label>
                  {!isActive && (
                    <input
                      type="checkbox"
                      checked={selected.includes(instrument.mint)}
                      onChange={() => toggle(instrument.mint)}
                      disabled={busy}
                    />
                  )}
                  <strong>{instrument.symbol}</strong> <span>{instrument.name}</span>
                </label>
                <span className="vt-field-note">
                  {hasHeld ? t('activate.existingBalance', { amount: amount(held?.quantity, instrument.symbol) }) : t('activate.noExistingBalance')}
                </span>
                {hasHeld && <span className="vt-field-note">{t('activate.costUnknown')}</span>}
              </li>
            );
          })}
        </ul>
        {!isActive && preexisting.length > 0 && (
          <label>
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} disabled={busy} />
            <span>{t('activate.confirmPreexisting')}</span>
          </label>
        )}
        {!isActive && (
          <GuardedButton variant="primary" reason={activateReason} onClick={() => void activate()}>
            {t('activate.activate')}
          </GuardedButton>
        )}
      </section>

      {error !== undefined && (
        <Notice tone="danger" title={inProgressId ? t('activate.inProgressTitle') : undefined}>
          {message(error)}
        </Notice>
      )}
      {inProgressId && (
        <Button variant="secondary" onClick={() => navigate(routes.operation(inProgressId))}>
          {t('actions.openInProgress')}
        </Button>
      )}

      {isActive && (
        <section className="vt-stack" aria-labelledby="invest-title">
          <Notice tone="info" title={t('activate.activeTitle')}>{t('activate.activeBody')}</Notice>
          <h2 id="invest-title">{t('activate.investTitle')}</h2>
          {items.map(({ instrument, plannedUsdc }) => {
            const { amount: inputUsdc, limited } = limitAmount(plannedUsdc, available);
            const payable = Number(inputUsdc) > 0;
            const reason = walletChanged
              ? t('activate.walletReason')
              : instrument.status !== 'approved'
                ? t('activate.notApproved')
                : !payable
                  ? t('activate.noFundsReason')
                  : busy
                    ? t('actions.working')
                    : undefined;
            return (
              <article key={instrument.id} className="vt-asset">
                <h3>{instrument.symbol} <span>{instrument.name}</span></h3>
                <p className="vt-field-note">{t('activate.planned', { amount: amount(plannedUsdc, CASH_SYMBOL) })}</p>
                {limited && <p className="vt-field-note">{t('activate.limitedTo', { amount: amount(inputUsdc, CASH_SYMBOL) })}</p>}
                <GuardedButton
                  variant="primary"
                  reason={reason}
                  onClick={() => void invest(instrument.id, inputUsdc)}
                >
                  {preparingId === instrument.id ? t('actions.working') : t('activate.invest', { amount: amount(inputUsdc, CASH_SYMBOL) })}
                </GuardedButton>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
