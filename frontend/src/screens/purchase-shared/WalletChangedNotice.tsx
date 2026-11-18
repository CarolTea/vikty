import { useTranslation } from 'react-i18next';
import { Notice } from '../../components';
import { shortAddress } from '../../wallet/wallet';
import { NS } from './types';

/** Blocks the screen's actions when the connected wallet is not the one the data belongs to. */
export function WalletChangedNotice({ expected, current, body }: { expected: string; current: string; body?: string }) {
  const { t } = useTranslation(NS);
  return (
    <Notice tone="danger" title={t('wallet.changedTitle')}>
      {body ?? t('wallet.changedBody', { expected: shortAddress(expected), current: shortAddress(current) })}
    </Notice>
  );
}
