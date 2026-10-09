import { createClientOnlyFn } from "@tanstack/react-start";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { WalletProvider } from "@/lib/demo/providers";
import { initialWalletSnapshot, walletErrorMessages } from "@/lib/demo/wallet-types";

const loadWalletProvider = createClientOnlyFn(() => import("@/lib/wallet/solana-wallet"));

const noSubscribe = () => () => {};
const initialSnapshot = () => initialWalletSnapshot;

export function useDemoWallet() {
  const [loadFailed, setLoadFailed] = useState(false);
  const [provider, setProvider] = useState<WalletProvider | null>(null);
  useEffect(() => {
    let cancelled = false;
    let instance: WalletProvider | undefined;
    void loadWalletProvider()
      .then(({ SolanaWalletProvider }) => {
        if (cancelled) return;
        instance = new SolanaWalletProvider();
        setProvider(instance);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
      instance?.dispose();
    };
  }, []);
  const wallet = useSyncExternalStore(
    provider?.subscribe ?? noSubscribe,
    provider?.getSnapshot ?? initialSnapshot,
    initialSnapshot,
  );
  return {
    provider,
    wallet: loadFailed
      ? {
          ...wallet,
          error: {
            code: "unexpected_error" as const,
            message: walletErrorMessages.unexpected_error,
          },
        }
      : wallet,
  };
}
