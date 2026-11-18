import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import { useErrorMessage } from '../../api/errors';
import { ApiError, type ApiErrorCode } from '../../api/transport';
import { useRequest } from '../../api/useRequest';
import { ErrorState, LoadingState, Notice } from '../../components';
import { formatBps } from '../../lib/format';
import { DetailRow } from '../purchase-shared/DetailRow';
import { GuardedButton } from '../purchase-shared/GuardedButton';
import { OperationStatusPill } from '../purchase-shared/OperationStatusPill';
import { PurchaseFrame } from '../purchase-shared/PurchaseFrame';
import { NS, type Operation } from '../purchase-shared/types';
import { useAmount } from '../purchase-shared/useAmount';
import { useConnectedWallet } from '../purchase-shared/useConnectedWallet';
import { formatClock, useCountdown } from '../purchase-shared/useCountdown';
import { useGuardedAction } from '../purchase-shared/useGuardedAction';
import { useIntentKey } from '../purchase-shared/useIntentKey';
import { useOperation } from '../purchase-shared/useOperation';
import { WalletChangedNotice } from '../purchase-shared/WalletChangedNotice';
import { routes } from '../routes';

/** Errors that make this purchase impossible until something outside the screen changes. */
const BLOCKING: ApiErrorCode[] = [
  'INSUFFICIENT_BALANCE',
  'INSTRUMENT_NOT_APPROVED',
  'INSTRUMENT_RESTRICTED',
  'INSTRUMENT_SUSPENDED',
  'NO_ROUTE',
  'WALLET_MISMATCH',
  'TRANSACTION_REJECTED',
];

export function PurchaseReviewScreen() {
  const { t } = useTranslation(NS);
  return (
    <PurchaseFrame title={t('review.title')} subtitle={t('review.subtitle')}>
      <PurchaseReviewContent />
    </PurchaseFrame>
  );
}

function PurchaseReviewContent() {
  const { t } = useTranslation(NS);
  const { id = '' } = useParams();
  const { token } = useConnectedWallet();
  const message = useErrorMessage();
  const { operation, error, loading, apply, reload } = useOperation(id, token);

  if (error && !operation) return <ErrorState message={message(error)} onRetry={reload} />;
  if (loading || !operation) return <LoadingState message={t('review.loading')} />;
  if (operation.status === 'preparing') return <LoadingState message={t('review.loading')} />;
  // Anything past the review lives on the operation screen; a reload there recovers the same state.
  if (['sending', 'pending', 'reconciling', 'confirmed', 'failed'].includes(operation.status)) {
    return <Navigate to={routes.operation(operation.id)} replace />;
  }
  return <ReviewBody operation={operation} apply={apply} />;
}

function ReviewBody({ operation, apply }: { operation: Operation; apply: (op: Operation) => void }) {
  const { t } = useTranslation(NS);
  const navigate = useNavigate();
  const message = useErrorMessage();
  const amount = useAmount();
  const { address, token, signTransaction } = useConnectedWallet();
  const { busy, run } = useGuardedAction();
  const { keyFor } = useIntentKey();
  const [actionError, setActionError] = useState<unknown>(undefined);

  const { review } = operation;
  const remaining = useCountdown(review?.expiresAt);
  const plan = useRequest(`plan:${operation.planId}`, () => api.getPlan(operation.planId, { token }));

  const expired = operation.status === 'expired' || remaining === 0;
  const needsNewQuote = expired || operation.status === 'rejected' || operation.status === 'awaiting_signature';
  const walletChanged = !!review && review.destinationWallet !== address;
  const restricted = operation.side === 'buy' && operation.instrument.status !== 'approved';
  const inconclusive = plan.status === 'success' && !plan.data.validation.conclusive;
  const noTransaction = !operation.transaction && !needsNewQuote;
  const blockedByError = actionError instanceof ApiError && BLOCKING.includes(actionError.code);

  const authorizeReason = busy
    ? t('actions.working')
    : walletChanged
      ? t('wallet.changedReason')
      : restricted
        ? t('review.restrictedReason')
        : inconclusive
          ? t('review.inconclusiveReason')
          : blockedByError
            ? t('review.blockedReason')
            : !review || !operation.transaction
              ? t('review.noTransactionReason')
              : undefined;
  const refreshReason = busy ? t('actions.working') : walletChanged ? t('wallet.changedReason') : undefined;

  const refresh = () =>
    run(async () => {
      setActionError(undefined);
      try {
        apply(await api.createQuote(operation.id, { token }));
      } catch (e) {
        // A material change comes with the new operation: show it so the user reviews the new numbers.
        if (e instanceof ApiError && e.code === 'MATERIAL_CHANGE' && e.details?.operation) {
          apply(e.details.operation as Operation);
        }
        setActionError(e);
      }
    });

  const authorize = () =>
    run(async () => {
      const transaction = operation.transaction;
      if (!transaction) return;
      setActionError(undefined);
      let sent = false;
      try {
        await api.recordSignatureEvent(operation.id, { type: 'signature_requested' }, { token });
        let signed: string;
        try {
          signed = await signTransaction(transaction);
        } catch {
          apply(await api.recordSignatureEvent(operation.id, { type: 'signature_rejected' }, { token }));
          return;
        }
        sent = true;
        await api.createSubmission(operation.id, { signedTransaction: signed }, keyFor(`submit:${operation.id}`), { token });
        navigate(routes.operation(operation.id));
      } catch (e) {
        // A timeout after sending is not a failure: the operation screen finds out what happened.
        if (sent && e instanceof ApiError && e.code === 'NETWORK_ERROR') {
          navigate(routes.operation(operation.id));
          return;
        }
        setActionError(e);
      }
    });

  const errorTone = actionError instanceof ApiError && (actionError.code === 'MATERIAL_CHANGE' || actionError.code === 'QUOTE_EXPIRED') ? 'warning' : 'danger';

  return (
    <div className="vt-stack">
      <OperationStatusPill status={operation.status} />
      {walletChanged && review && <WalletChangedNotice expected={review.destinationWallet} current={address} />}
      {expired && (
        <Notice tone="warning" title={t('review.expiredTitle')}>{t('review.expiredBody')}</Notice>
      )}
      {operation.status === 'rejected' && (
        <Notice tone="warning" title={t('review.refusedTitle')}>{t('review.refusedBody')}</Notice>
      )}
      {operation.status === 'awaiting_signature' && (
        <Notice tone="warning" title={t('review.reloadedTitle')}>{t('review.reloadedBody')}</Notice>
      )}
      {noTransaction && (
        <Notice tone="danger" title={t('review.noTransactionTitle')}>{t('review.noTransactionBody')}</Notice>
      )}
      {restricted && (
        <Notice tone="danger" title={t('review.restrictedTitle')}>{t('review.restrictedBody')}</Notice>
      )}
      {inconclusive && (
        <Notice tone="warning" title={t('review.inconclusiveTitle')}>{t('review.inconclusiveBody')}</Notice>
      )}
      {actionError !== undefined && <Notice tone={errorTone}>{message(actionError)}</Notice>}

      {review ? (
        <>
          <section className="vt-asset" aria-labelledby="review-title">
            <h2 id="review-title">{operation.instrument.symbol} <span>{operation.instrument.name}</span></h2>
            <DetailRow label={t('review.input')}>{amount(review.inputAmount, review.inputSymbol)}</DetailRow>
            <DetailRow label={t('review.estimatedOutput')}>{amount(review.estimatedOutput, review.outputSymbol)}</DetailRow>
            <DetailRow label={t('review.minimumOutput')}>{amount(review.minimumOutput, review.outputSymbol)}</DetailRow>
            <DetailRow label={t('review.slippage')}>{formatBps(review.slippageBps)}</DetailRow>
            <DetailRow label={t('review.fees')}>
              {review.fees.length === 0
                ? t('review.noFees')
                : review.fees.map((fee) => t('review.fee', { label: fee.label, amount: amount(fee.amount, fee.symbol) })).join(t('review.feeSeparator'))}
            </DetailRow>
            <DetailRow label={t('review.destination')}>{review.destinationWallet}</DetailRow>
            <DetailRow label={t('review.expiresIn')}>
              {remaining === undefined || remaining === 0 ? t('review.expiredValue') : formatClock(remaining)}
            </DetailRow>
          </section>

          <section className="vt-asset" aria-labelledby="effect-title">
            <h2 id="effect-title">{t('review.effectTitle')}</h2>
            <DetailRow label={t('review.effectTarget')}>{formatBps(review.planEffect.targetBps)}</DetailRow>
            <DetailRow label={t('review.effectCurrent')}>
              {review.planEffect.currentBps === null ? t('unavailable') : formatBps(review.planEffect.currentBps)}
            </DetailRow>
            <DetailRow label={t('review.effectAfter')}>
              {review.planEffect.afterBps === null ? t('unavailable') : formatBps(review.planEffect.afterBps)}
            </DetailRow>
          </section>
        </>
      ) : (
        <Notice tone="warning">{t('review.noReviewBody')}</Notice>
      )}

      <div className="vt-row">
        {needsNewQuote || !review ? (
          <GuardedButton variant="primary" reason={refreshReason} onClick={() => void refresh()}>
            {t('review.refresh')}
          </GuardedButton>
        ) : (
          <>
            <GuardedButton variant="primary" icon="lock" reason={authorizeReason} onClick={() => void authorize()}>
              {t('review.authorize')}
            </GuardedButton>
            <GuardedButton variant="secondary" reason={refreshReason} onClick={() => void refresh()}>
              {t('review.refresh')}
            </GuardedButton>
          </>
        )}
        <GuardedButton variant="ghost" reason={busy ? t('actions.working') : undefined} onClick={() => navigate(routes.activatePlan(operation.planId))}>
          {t('review.cancel')}
        </GuardedButton>
      </div>
    </div>
  );
}
