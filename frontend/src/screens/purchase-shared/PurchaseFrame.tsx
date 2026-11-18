import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AppHeader, EmptyState, Page } from '../../components';
import { shortAddress, useWallet } from '../../wallet/wallet';
import { NS } from './types';

export interface PurchaseFrameProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

/** Page shell for the purchase screens; the content only renders once a wallet is connected. */
export function PurchaseFrame({ title, subtitle, children }: PurchaseFrameProps) {
  const { t } = useTranslation(NS);
  const { address, token, connect } = useWallet();
  const onConnect = () => void connect();
  return (
    <Page header={<AppHeader address={address ? shortAddress(address) : undefined} onConnect={onConnect} />}>
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
      {address && token ? (
        children
      ) : (
        <EmptyState
          icon="lock"
          title={t('wallet.connectTitle')}
          description={t('wallet.connectDescription')}
          actions={[{ label: t('wallet.connect'), variant: 'primary', onClick: onConnect }]}
        />
      )}
    </Page>
  );
}
