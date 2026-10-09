import { address, getPublicKeyFromAddress, signatureBytes, verifySignature } from "@solana/kit";
import { approvalMessage } from "./approval-message";
import { DEMO_NETWORK, type ApprovalChallenge } from "./wallet-types";

export type StoredChallenge = { challenge: ApprovalChallenge; consumedAt: string | null };
export type ChallengeStore = {
  find(id: string, sessionId: string): Promise<StoredChallenge | null>;
  // Must atomically check expiry and unused status in the database before consuming.
  consume(id: string, sessionId: string): Promise<boolean>;
};
export type ApprovalProof = {
  challengeId: string;
  sessionId: string;
  walletAddress: string;
  origin: string;
  signature: number[];
};
export class InvalidApprovalError extends Error {
  constructor() {
    super("Approval could not be verified. Please request a new approval.");
  }
}
export async function verifyAndConsumeApproval(
  store: ChallengeStore,
  proof: ApprovalProof,
  now = Date.now(),
): Promise<ApprovalChallenge> {
  const stored = await store.find(proof.challengeId, proof.sessionId);
  const challenge = stored?.challenge;
  if (
    !stored ||
    !challenge ||
    stored.consumedAt ||
    challenge.id !== proof.challengeId ||
    challenge.sessionId !== proof.sessionId ||
    challenge.walletAddress !== proof.walletAddress ||
    challenge.origin !== proof.origin ||
    challenge.network !== DEMO_NETWORK ||
    !Number.isFinite(Date.parse(challenge.expiresAt)) ||
    Date.parse(challenge.expiresAt) <= now ||
    Date.parse(challenge.issuedAt) > now ||
    proof.signature.length !== 64
  )
    throw new InvalidApprovalError();
  let valid = false;
  try {
    const publicKey = await getPublicKeyFromAddress(address(challenge.walletAddress));
    valid = await verifySignature(
      publicKey,
      signatureBytes(new Uint8Array(proof.signature)),
      new TextEncoder().encode(approvalMessage(challenge)),
    );
  } catch {
    /* Malformed public key/signature is an invalid proof, never approval. */
  }
  if (!valid || !(await store.consume(challenge.id, challenge.sessionId)))
    throw new InvalidApprovalError();
  return challenge;
}
