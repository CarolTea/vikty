import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { WalletNamespace, WalletState } from "@solana/kit-plugin-wallet";
import { SolanaWalletProvider } from "../src/lib/wallet/solana-wallet";
import {
  DEMO_NETWORK,
  type ApprovalTransport,
  type ApprovalChallenge,
} from "../src/lib/demo/wallet-types";

const origin = "https://victy.example";
const account = {
  address: "11111111111111111111111111111111",
  chains: [DEMO_NETWORK],
  features: ["solana:signMessage"],
};
const asset = {
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
};
function fixture(
  options: { rejectConnect?: boolean; rejectSign?: boolean; noWallets?: boolean } = {},
) {
  const wallet = { name: "Test Wallet" };
  let state = {
    wallets: options.noWallets ? [] : [wallet],
    connected: null,
    status: "disconnected",
  } as unknown as WalletState;
  const listeners = new Set<() => void>();
  const update = (address: string | null) => {
    state = {
      ...state,
      status: address ? "connected" : "disconnected",
      connected: address ? { account: { ...account, address }, wallet, signer: null } : null,
    } as unknown as WalletState;
    for (const callback of listeners) callback();
  };
  let verificationCalls = 0;
  let signingCalls = 0;
  const namespace = {
    getState: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    whenReady: async () => {},
    connect: async () => {
      if (options.rejectConnect) throw { code: 4001 };
      update(account.address);
      return [account];
    },
    disconnect: async () => update(null),
    signMessage: async () => {
      signingCalls++;
      if (options.rejectSign) throw { code: 4001 };
      return new Uint8Array(64);
    },
  } as unknown as WalletNamespace;
  const provider = new SolanaWalletProvider(() => ({
    wallet: namespace,
    dispose: () => listeners.clear(),
  }));
  const challenge: ApprovalChallenge = {
    id: crypto.randomUUID(),
    nonce: "a".repeat(64),
    sessionId: crypto.randomUUID(),
    walletAddress: account.address,
    network: DEMO_NETWORK,
    origin,
    asset,
    amount: 350,
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 300_000).toISOString(),
  };
  const transport: ApprovalTransport = {
    issue: async () => challenge,
    verify: async () => {
      verificationCalls++;
      return {
        id: crypto.randomUUID(),
        assetId: asset.id,
        ticker: asset.ticker,
        amount: 350,
        provider: "Jupiter demo",
        route: "USDC → NVDA",
        status: "simulated",
        createdAt: new Date().toISOString(),
        walletAddress: account.address,
        walletApproval: "verified",
        network: DEMO_NETWORK,
        approvedAt: new Date().toISOString(),
      };
    },
  };
  const connect = async () => {
    const choices = await provider.discover();
    await provider.connect(choices[0]!.id);
  };
  return {
    provider,
    update,
    transport,
    connect,
    verificationCalls: () => verificationCalls,
    signingCalls: () => signingCalls,
  };
}

describe("wallet lifecycle without a browser or extension", () => {
  before(() =>
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { location: { origin } },
    }),
  );
  after(() => Reflect.deleteProperty(globalThis, "window"));
  it("reports unavailable wallets without a fictitious connection", async () => {
    const f = fixture({ noWallets: true });
    await assert.rejects(f.provider.discover());
    assert.equal(f.provider.getSnapshot().error?.code, "wallet_unavailable");
    assert.equal(f.provider.getSnapshot().address, null);
    f.provider.dispose();
  });
  it("handles connection rejection", async () => {
    const f = fixture({ rejectConnect: true });
    await assert.rejects(f.connect());
    assert.equal(f.provider.getSnapshot().error?.code, "connection_rejected");
    assert.equal(f.provider.getSnapshot().address, null);
    f.provider.dispose();
  });
  it("handles signature rejection without contacting verification", async () => {
    const f = fixture({ rejectSign: true });
    await f.connect();
    await assert.rejects(f.provider.signApproval(asset, 350, f.transport));
    assert.equal(f.provider.getSnapshot().error?.code, "signature_rejected");
    assert.equal(f.provider.getSnapshot().status, "connected");
    assert.equal(f.verificationCalls(), 0);
    f.provider.dispose();
  });
  it("never approves when verification fails", async () => {
    const f = fixture();
    await f.connect();
    f.transport.verify = async () => {
      throw new Error("invalid proof");
    };
    await assert.rejects(f.provider.signApproval(asset, 350, f.transport));
    assert.equal(f.provider.getSnapshot().status, "connected");
    assert.equal(f.provider.getSnapshot().error?.code, "unexpected_error");
    f.provider.dispose();
  });
  it("invalidates an approval on account change and disconnect", async () => {
    const f = fixture();
    await f.connect();
    await f.provider.signApproval(asset, 350, f.transport);
    assert.equal(f.provider.getSnapshot().status, "approved");
    f.update("another-account");
    assert.equal(f.provider.getSnapshot().status, "connected");
    assert.equal(f.provider.getSnapshot().error?.code, "account_changed");
    f.update(null);
    assert.equal(f.provider.getSnapshot().status, "disconnected");
    assert.equal(f.provider.getSnapshot().error?.code, "wallet_disconnected");
    f.provider.dispose();
  });
  it("blocks duplicate signing while verification is pending", async () => {
    const f = fixture();
    await f.connect();
    const verify = f.transport.verify;
    let release!: () => void;
    const wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    f.transport.verify = async (proof) => {
      await wait;
      return verify(proof);
    };
    const first = f.provider.signApproval(asset, 350, f.transport);
    await assert.rejects(f.provider.signApproval(asset, 350, f.transport));
    assert.equal(f.provider.getSnapshot().status, "signing");
    release();
    await first;
    assert.equal(f.signingCalls(), 1);
    assert.equal(f.verificationCalls(), 1);
    f.provider.dispose();
  });
  it("discards an in-flight approval after an account change", async () => {
    const f = fixture();
    await f.connect();
    const issue = f.transport.issue;
    f.transport.issue = async (input) => {
      const challenge = await issue(input);
      f.update("another-account");
      return challenge;
    };
    await assert.rejects(f.provider.signApproval(asset, 350, f.transport));
    assert.equal(f.signingCalls(), 0);
    assert.equal(f.verificationCalls(), 0);
    assert.equal(f.provider.getSnapshot().error?.code, "account_changed");
    f.provider.dispose();
  });
});
