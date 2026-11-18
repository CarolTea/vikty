import { createContext, useContext } from 'react';

/**
 * The connected wallet as screens see it. The mock below stands in until the Privy integration;
 * screens only use this interface, so swapping the implementation changes no screen.
 */
export interface Wallet {
  /** Base58 address, or null when no wallet is connected. */
  address: string | null;
  /** Access token sent to wallet routes; null until authenticated. */
  token: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  /** Asks the wallet to sign a serialized transaction (base64); resolves the signed one, rejects if refused. */
  signTransaction: (transactionBase64: string) => Promise<string>;
}

export const WalletContext = createContext<Wallet | null>(null);

export function useWallet(): Wallet {
  const wallet = useContext(WalletContext);
  if (!wallet) throw new Error('useWallet must be used inside a WalletProvider');
  return wallet;
}

/** Shortens an address for display, e.g. "7xKX…sgAsU". */
export function shortAddress(address: string): string {
  return address.length > 12 ? `${address.slice(0, 4)}…${address.slice(-5)}` : address;
}
