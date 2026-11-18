import { useWallet } from '../../wallet/wallet';

/** The wallet inside PurchaseFrame, which only renders its content once connected and authenticated. */
export function useConnectedWallet() {
  const wallet = useWallet();
  if (!wallet.address || !wallet.token) throw new Error('Rendered without a connected wallet');
  return { ...wallet, address: wallet.address, token: wallet.token };
}
