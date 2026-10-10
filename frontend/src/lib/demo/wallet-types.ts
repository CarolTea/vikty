import type { DemoAsset, SimulatedInvestment } from "./types";

export const DEMO_NETWORK = "solana:devnet" as const;
export type WalletStatus =
  "disconnected" | "discovering" | "connecting" | "connected" | "signing" | "approved";
export type WalletErrorCode =
  | "wallet_unavailable"
  | "connection_rejected"
  | "signature_rejected"
  | "wallet_disconnected"
  | "account_changed"
  | "unexpected_error";
export type WalletChoice = { id: string; name: string };
export type WalletSnapshot = {
  status: WalletStatus;
  wallets: readonly WalletChoice[];
  address: string | null;
  network: typeof DEMO_NETWORK;
  error: { code: WalletErrorCode; message: string } | null;
};
export const initialWalletSnapshot: WalletSnapshot = {
  status: "disconnected",
  wallets: [],
  address: null,
  network: DEMO_NETWORK,
  error: null,
};
export type ApprovalChallenge = {
  id: string;
  nonce: string;
  sessionId: string;
  walletAddress: string;
  network: typeof DEMO_NETWORK;
  origin: string;
  asset: DemoAsset;
  amount: number;
  issuedAt: string;
  expiresAt: string;
};
export type ApprovalTransport = {
  issue(input: {
    asset: DemoAsset;
    amount: number;
    walletAddress: string;
  }): Promise<ApprovalChallenge>;
  verify(input: {
    challengeId: string;
    walletAddress: string;
    signature: number[];
  }): Promise<SimulatedInvestment>;
};
export const walletErrorMessages: Record<WalletErrorCode, string> = {
  wallet_unavailable:
    "No compatible wallet is available. Open Phantom or another Solana wallet with message signing and Devnet support, then try again.",
  connection_rejected: "Connection was cancelled in your wallet. Please try again when ready.",
  signature_rejected: "Approval was cancelled in your wallet. Nothing was changed.",
  wallet_disconnected:
    "Your wallet was disconnected. Reconnect before approving this demo investment.",
  account_changed:
    "Your wallet account changed. Please review and approve again with the current account.",
  unexpected_error:
    "Wallet approval could not be completed. Please try again. No real asset purchase occurred.",
};
