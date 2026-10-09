import { randomBytes, randomUUID } from "node:crypto";
import { address } from "@solana/kit";
import { getRequest } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import { verifiedSession } from "./demo/session.server";
import { demoProviders } from "./demo/providers";
import type { DemoAsset, DemoSessionCredentials } from "./demo/types";
import { DEMO_NETWORK, type ApprovalChallenge } from "./demo/wallet-types";
import { verifyAndConsumeApproval, type ChallengeStore } from "./demo/approval-verification.server";

function requestOrigin() {
  // Origin is browser-supplied, forbidden to page JS to forge, and the global
  // TanStack CSRF middleware enforces same-origin server function requests.
  const value = getRequest().headers.get("origin");
  if (!value) throw new Error("Approval requires a browser origin.");
  const url = new URL(value);
  if (
    url.protocol !== "https:" &&
    !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
  )
    throw new Error("Wallet approval requires a secure origin.");
  return url.origin;
}

export async function issueApproval(input: {
  credentials: DemoSessionCredentials;
  walletAddress: string;
  asset: DemoAsset;
  amount: number;
}) {
  if (!(await verifiedSession(input.credentials))) throw new Error("Demo session unavailable");
  address(input.walletAddress);
  if (!input.asset.active || input.amount !== Math.round((1000 * input.asset.allocation) / 100))
    throw new Error("Review the demo allocation before approving.");
  const now = new Date();
  const challenge: ApprovalChallenge = {
    id: randomUUID(),
    nonce: randomBytes(32).toString("hex"),
    sessionId: input.credentials.id,
    walletAddress: input.walletAddress,
    network: DEMO_NETWORK,
    origin: requestOrigin(),
    asset: input.asset,
    amount: input.amount,
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 5 * 60_000).toISOString(),
  };
  const { error } = await supabaseAdmin.from("demo_wallet_approval_challenges").insert({
    id: challenge.id,
    demo_session_id: challenge.sessionId,
    wallet_address: challenge.walletAddress,
    nonce: challenge.nonce,
    challenge: challenge as unknown as Json,
    expires_at: challenge.expiresAt,
  });
  if (error) throw new Error("Wallet approval is temporarily unavailable.");
  return challenge;
}

const store: ChallengeStore = {
  async find(id, sessionId) {
    const { data, error } = await supabaseAdmin
      .from("demo_wallet_approval_challenges")
      .select("challenge, consumed_at")
      .eq("id", id)
      .eq("demo_session_id", sessionId)
      .maybeSingle();
    if (error) throw new Error("Wallet approval is temporarily unavailable.");
    return data
      ? { challenge: data.challenge as unknown as ApprovalChallenge, consumedAt: data.consumed_at }
      : null;
  },
  async consume(id, sessionId) {
    const { data, error } = await supabaseAdmin.rpc("consume_demo_wallet_approval", {
      challenge_id: id,
      session_id: sessionId,
    });
    if (error) throw new Error("Wallet approval is temporarily unavailable.");
    return data === true;
  },
};

export async function verifyApproval(input: {
  credentials: DemoSessionCredentials;
  challengeId: string;
  walletAddress: string;
  signature: number[];
}) {
  if (!(await verifiedSession(input.credentials))) throw new Error("Demo session unavailable");
  const challenge = await verifyAndConsumeApproval(store, {
    ...input,
    sessionId: input.credentials.id,
    origin: requestOrigin(),
  });
  return demoProviders.execution.simulate(challenge.asset, challenge.amount, {
    walletAddress: challenge.walletAddress,
    approvedAt: new Date().toISOString(),
  });
}
