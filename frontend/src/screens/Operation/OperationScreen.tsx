import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import { useErrorMessage } from '../../api/errors';
import { ApiError } from '../../api/transport';
import { ErrorState, Icon, LoadingState, Notice, ProgressSteps } from '../../components';
import { DetailRow } from '../purchase-shared/DetailRow';
import { GuardedButton } from '../purchase-shared/GuardedButton';
import { OperationStatusPill } from '../purchase-shared/OperationStatusPill';
import { PurchaseFrame } from '../purchase-shared/PurchaseFrame';
import { STEP_KEYS, statusStep } from '../purchase-shared/status';
import { NS, type Operation } from '../purchase-shared/types';
import { useAmount } from '../purchase-shared/useAmount';
import { useConnectedWallet } from '../purchase-shared/useConnectedWallet';
import { useGuardedAction } from '../purchase-shared/useGuardedAction';
import { useIntentKey } from '../purchase-shared/useIntentKey';
import { useOperation } from '../purchase-shared/useOperation';
import { WalletChangedNotice } from '../purchase-shared/WalletChangedNotice';
import { routes } from '../routes';

export function OperationScreen() {
  const { t } = useTranslation(NS);
  return (
    <PurchaseFrame title={t('operation.title')} subtitle={t('operation.subtitle')}>
      <OperationContent />
    </PurchaseFrame>
  );
}

function OperationContent() {
  const { t } = useTranslation(NS);
  const { id = '' } = useParams();
  const { token } = useConnectedWallet();
  const message = useErrorMessage();
  const { operation, error, loading, reload } = useOperation(id, token);

  if (error && !operation) return <ErrorState message={message(error)} onRetry={reload} />;
  if (loading || !operation) return <LoadingState message={t('operation.loading')} />;
  return <OperationBody operation={operation} refreshFailed={error !== undefined} />;
}

function OperationBody({ operation, refreshFailed }: { operation: Operation; refreshFailed: boolean }) {
  const { t } = useTranslation(NS);
  const navigate = useNavigate();
  const message = useErrorMessage();
  const amount = useAmount();
  const { address, token } = useConnectedWallet();
  const { busy, run } = useGuardedAction();
  const { keyFor } = useIntentKey();
  const [retryError, setRetryError] = useState<unknown>(undefined);
  const [notSettled, setNotSettled] = useState(false);

  const { status, review, result, instrument } = operation;
  const walletChanged = !!review && review.destinationWallet !== address;
  const moving = status === 'sending' || status === 'pending' || status === 'reconciling';
  const inputSymbol = review?.inputSymbol ?? (operation.side === 'buy' ? 'USDC' : instrument.symbol);
  const outputSymbol = review?.outputSymbol ?? (operation.side === 'buy' ? instrument.symbol : 'USDC');
  const explorerUrl = result.explorerUrl && /^https?:\/\//.test(result.explorerUrl) ? result.explorerUrl : null;
  const canRetryFresh = status === 'failed' && operation.side === 'buy' && !!review;

  // Retrying only starts after the previous attempt was looked up again and is really over.
  const retry = () =>
    run(async () => {
      setRetryError(undefined);
      setNotSettled(false);
      try {
        const previous = await api.getOperation(operation.id, { token });
        if (previous.status !== 'failed') {
          setNotSettled(true);
          return;
        }
        const fresh = await api.prepareOperation(
          { planId: operation.planId, side: 'buy', instrumentId: instrument.id, inputUsdc: review?.inputAmount ?? '' },
          keyFor(`retry:${operation.id}`),
          { token },
        );
        navigate(routes.purchaseReview(fresh.id));
      } catch (e) {
        if (e instanceof ApiError && e.code === 'OPERATION_IN_PROGRESS' && typeof e.details?.operationId === 'string') {
          navigate(routes.operation(e.details.operationId));
          return;
        }
        setRetryError(e);
      }
    });

  const reviewable = status === 'ready_for_review' || status === 'awaiting_signature' || status === 'rejected' || status === 'expired';
  const retryReason = busy ? t('actions.working') : walletChanged ? t('wallet.changedReason') : undefined;

  return (
    <div className="vt-stack">
      <OperationStatusPill status={status} />
      <ProgressSteps steps={STEP_KEYS.map((key) => t(`steps.${key}`))} current={statusStep(status)} />
      <Notice tone={status === 'failed' ? 'danger' : status === 'confirmed' ? 'info' : 'warning'}>
        {t(`operation.text.${status}`)}
      </Notice>
      {refreshFailed && <Notice tone="warning">{t('operation.refreshError')}</Notice>}
      {walletChanged && review && <WalletChangedNotice expected={review.destinationWallet} current={address} />}

      {status === 'failed' && (
        <>
          {result.failureReason && <Notice tone="danger">{t('operation.failureReason', { reason: result.failureReason })}</Notice>}
          <Notice tone="info">{t('operation.checkFirst')}</Notice>
        </>
      )}
      {status === 'confirmed' && (
        <Notice tone="info">{operation.balanceUpdating ? t('operation.balanceUpdating') : t('operation.balanceUpdated')}</Notice>
      )}
      {notSettled && <Notice tone="warning">{t('operation.retryNotSettled')}</Notice>}
      {retryError !== undefined && <Notice tone="danger">{message(retryError)}</Notice>}

      <section className="vt-asset" aria-labelledby="operation-title">
        <h2 id="operation-title">{instrument.symbol} <span>{instrument.name}</span></h2>
        <DetailRow label={t('operation.kind')}>{t(`operation.side.${operation.side}`)}</DetailRow>
        {status === 'confirmed' ? (
          result.inputAmount === null && result.outputAmount === null ? (
            <p className="vt-field-note">{t('operation.effectiveMissing')}</p>
          ) : (
            <>
              <DetailRow label={t('operation.effectiveInput')}>{amount(result.inputAmount, inputSymbol)}</DetailRow>
              <DetailRow label={t('operation.effectiveOutput')}>{amount(result.outputAmount, outputSymbol)}</DetailRow>
            </>
          )
        ) : (
          review && (
            <>
              <DetailRow label={t('operation.plannedInput')}>{amount(review.inputAmount, inputSymbol)}</DetailRow>
              <DetailRow label={t('operation.estimatedOutput')}>{amount(review.estimatedOutput, outputSymbol)}</DetailRow>
            </>
          )
        )}
      </section>
      <p className="vt-field-note">{t('operation.restOfPlan')}</p>

      <div className="vt-row">
        {explorerUrl && (
          <a className="vt-btn vt-btn-secondary" href={explorerUrl} target="_blank" rel="noopener noreferrer">
            <Icon name="external" size={18} />
            <span>{t('actions.viewTransaction')}</span>
          </a>
        )}
        {reviewable && (
          <GuardedButton
            variant="primary"
            reason={walletChanged ? t('wallet.changedReason') : undefined}
            onClick={() => navigate(routes.purchaseReview(operation.id))}
          >
            {status === 'ready_for_review' ? t('actions.continueReview') : t('actions.reviewAgain')}
          </GuardedButton>
        )}
        {canRetryFresh && (
          <GuardedButton variant="primary" reason={retryReason} onClick={() => void retry()}>
            {t('actions.retry')}
          </GuardedButton>
        )}
        {moving && (
          <GuardedButton variant="secondary" reason={t('operation.waitReason')} onClick={() => undefined}>
            {t('actions.retry')}
          </GuardedButton>
        )}
        <GuardedButton variant="secondary" onClick={() => navigate(routes.activatePlan(operation.planId))}>
          {t('actions.backToPlan')}
        </GuardedButton>
      </div>
    </div>
  );
}
