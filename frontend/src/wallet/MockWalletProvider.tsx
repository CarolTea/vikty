import { useMemo, useState, type ReactNode } from 'react';
import { WalletContext, type Wallet } from './wallet';

const MOCK_ADDRESS = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';

/** In-memory wallet for mock mode: connecting is instant and signing always succeeds. */
export function MockWalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const wallet = useMemo<Wallet>(
    () => ({
      address,
      token: address ? 'mock-token' : null,
      connect: async () => setAddress(MOCK_ADDRESS),
      disconnect: () => setAddress(null),
      signTransaction: async (tx) => tx,
    }),
    [address],
  );
  return <WalletContext.Provider value={wallet}>{children}</WalletContext.Provider>;
}
