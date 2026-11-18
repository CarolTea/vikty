import { useTranslation } from 'react-i18next';
import { AssetCard, WeightField } from '../../components';
import type { Api } from '../../api/client';

export type ProposalItem = Awaited<ReturnType<Api['getProposal']>>['items'][number];

export interface AssetEntryProps {
  item: ProposalItem;
  /** Current draft weight (basis points). */
  weightBps: number;
  rejected: boolean;
  /** Planned amount from the latest validation; null while it is being re-checked. */
  amount: string | null;
  /** Why Invest is blocked for this asset, if it is. */
  investDisabledReason?: string;
  onWeightChange: (bps: number) => void;
  onReject: () => void;
  onUndo: () => void;
  onDetails: () => void;
  onInvest: () => void;
}

/** One asset of the composition: its card plus the weight field the user edits. */
export function AssetEntry(props: AssetEntryProps) {
  const { item, weightBps, rejected, amount } = props;
  const { t } = useTranslation('composition-screen');
  const { instrument } = item;
  const { buy, sell } = item.availability;
  const reason =
    props.investDisabledReason ??
    (instrument.status !== 'approved' ? t('invest.notApproved', { name: instrument.symbol }) : undefined) ??
    (buy !== 'available' ? t('invest.noRoute', { name: instrument.symbol }) : undefined);

  return (
    <div className="vt-stack">
      <AssetCard
        ticker={instrument.symbol}
        name={instrument.name}
        exposure={instrument.exposureLabel}
        why={item.rationale}
        risks={item.risks}
        availability={{ buy, sell }}
        weightBps={weightBps}
        amount={amount}
        kind={instrument.kind === 'cash' ? 'cash' : undefined}
        state={rejected ? 'rejected' : undefined}
        investDisabledReason={reason}
        onUndo={props.onUndo}
        onDetails={props.onDetails}
        onReject={props.onReject}
        onInvest={props.onInvest}
      />
      {!rejected && <WeightField weightBps={weightBps} onChange={props.onWeightChange} amount={amount} />}
    </div>
  );
}
