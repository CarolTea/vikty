import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSigner, signBytes } from "@solana/kit";
import { approvalMessage } from "../src/lib/demo/approval-message";
import {
  verifyAndConsumeApproval,
  type ChallengeStore,
} from "../src/lib/demo/approval-verification.server";
import { DEMO_NETWORK, type ApprovalChallenge } from "../src/lib/demo/wallet-types";
import { SolanaWalletProvider } from "../src/lib/wallet/solana-wallet";

async function fixture() {
  const signer = await generateKeyPairSigner();
  const now = Date.now();
  const challenge: ApprovalChallenge = {
    id: crypto.randomUUID(),
    nonce: "a".repeat(64),
    sessionId: crypto.randomUUID(),
    walletAddress: signer.address,
    network: DEMO_NETWORK,
    origin: "https://victy.example",
    asset: {
      id: "nvda",
      ticker: "NVDA",
      name: "NVIDIA",
      allocation: 35,
      exposure: "Compute",
      why: "Demo",
      risks: "Demo",
      availability: "Demo",
      category: "Equity",
      price: 172.4,
      active: true,
    },
    amount: 350,
    issuedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 300_000).toISOString(),
  };
  let consumedAt: string | null = null;
  let databaseNow = now;
  let consumes = 0;
  const store: ChallengeStore = {
    async find(id, sessionId) {
      return id === challenge.id && sessionId === challenge.sessionId
        ? { challenge, consumedAt }
        : null;
    },
    async consume() {
      if (consumedAt || Date.parse(challenge.expiresAt) <= databaseNow) return false;
      consumedAt = new Date(databaseNow).toISOString();
      consumes++;
      return true;
    },
  };
  const signature = Array.from(
    await signBytes(
      signer.keyPair.privateKey,
      new TextEncoder().encode(approvalMessage(challenge)),
    ),
  );
  const proof = {
    challengeId: challenge.id,
    sessionId: challenge.sessionId,
    walletAddress: signer.address as string,
    origin: challenge.origin,
    signature,
  };
  return {
    challenge,
    proof,
    store,
    signer,
    now,
    consumes: () => consumes,
    expireInDatabase: () => {
      databaseNow = now + 300_001;
    },
  };
}

describe("demo wallet challenge verification", () => {
  it("accepts a valid signature and consumes exactly once", async () => {
    const f = await fixture();
    assert.equal((await verifyAndConsumeApproval(f.store, f.proof, f.now)).amount, 350);
    assert.equal(f.consumes(), 1);
  });
  it("rejects an expired challenge, including the exact expiry instant", async () => {
    const f = await fixture();
    await assert.rejects(verifyAndConsumeApproval(f.store, f.proof, f.now + 300_000));
    assert.equal(f.consumes(), 0);
  });
  it("rejects reuse of the same nonce/challenge", async () => {
    const f = await fixture();
    await verifyAndConsumeApproval(f.store, f.proof, f.now);
    await assert.rejects(verifyAndConsumeApproval(f.store, f.proof, f.now));
    assert.equal(f.consumes(), 1);
  });
  it("allows only one concurrent verification to consume", async () => {
    const f = await fixture();
    const results = await Promise.allSettled([
      verifyAndConsumeApproval(f.store, f.proof, f.now),
      verifyAndConsumeApproval(f.store, f.proof, f.now),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  });
  it("rejects an invalid signature without consuming the challenge", async () => {
    const f = await fixture();
    f.proof.signature[0] = f.proof.signature[0]! ^ 1;
    await assert.rejects(verifyAndConsumeApproval(f.store, f.proof, f.now));
    assert.equal(f.consumes(), 0);
  });
  it("rejects a different wallet address", async () => {
    const f = await fixture();
    f.proof.walletAddress = (await generateKeyPairSigner()).address;
    await assert.rejects(verifyAndConsumeApproval(f.store, f.proof, f.now));
  });
  it("rejects a signature produced by another wallet even when claiming the expected address", async () => {
    const f = await fixture();
    const other = await generateKeyPairSigner();
    f.proof.signature = Array.from(
      await signBytes(
        other.keyPair.privateKey,
        new TextEncoder().encode(approvalMessage(f.challenge)),
      ),
    );
    await assert.rejects(verifyAndConsumeApproval(f.store, f.proof, f.now));
  });
  it("rejects another demo session", async () => {
    const f = await fixture();
    f.proof.sessionId = crypto.randomUUID();
    await assert.rejects(verifyAndConsumeApproval(f.store, f.proof, f.now));
  });
  it("rejects another origin", async () => {
    const f = await fixture();
    f.proof.origin = "https://other.example";
    await assert.rejects(verifyAndConsumeApproval(f.store, f.proof, f.now));
  });
  it("rejects a changed amount instead of trusting submitted content", async () => {
    const f = await fixture();
    f.challenge.amount = 500;
    await assert.rejects(verifyAndConsumeApproval(f.store, f.proof, f.now));
  });
  it("rejects a non-Devnet challenge even if signed", async () => {
    const f = await fixture();
    Object.assign(f.challenge, { network: "solana:mainnet" });
    f.proof.signature = Array.from(
      await signBytes(
        f.signer.keyPair.privateKey,
        new TextEncoder().encode(approvalMessage(f.challenge)),
      ),
    );
    await assert.rejects(verifyAndConsumeApproval(f.store, f.proof, f.now));
  });
  it("rejects expiry during verification at the atomic store boundary", async () => {
    const f = await fixture();
    f.expireInDatabase();
    await assert.rejects(verifyAndConsumeApproval(f.store, f.proof, f.now));
  });
  it("has an SSR-safe provider with no fictitious connection", () => {
    const provider = new SolanaWalletProvider();
    assert.equal(provider.getSnapshot().address, null);
    assert.equal(provider.getSnapshot().status, "disconnected");
    provider.dispose();
  });
});
