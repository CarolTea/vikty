import type { ApprovalChallenge } from "./wallet-types";

// Shared canonical text: verification reconstructs it from the server record,
// never from a message supplied by the browser.
export function approvalMessage(challenge: ApprovalChallenge): string {
  return [
    "VicTy Demo Approval",
    "",
    `Origin: ${challenge.origin}`,
    "Network: Solana Devnet (solana:devnet)",
    "Action: Approve simulated investment",
    `Asset: ${challenge.asset.ticker} (${challenge.asset.id})`,
    `Simulated amount: USD ${challenge.amount.toFixed(2)}`,
    `Wallet: ${challenge.walletAddress}`,
    `Demo session: ${challenge.sessionId}`,
    `Challenge: ${challenge.id}`,
    `Nonce: ${challenge.nonce}`,
    `Issued at: ${challenge.issuedAt}`,
    `Expires at: ${challenge.expiresAt}`,
    "",
    "No real asset purchase will occur.",
    "This off-chain approval does not send a transaction or move funds.",
  ].join("\n");
}
