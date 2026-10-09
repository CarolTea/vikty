import { createClient } from "@solana/kit";
import { walletSigner, type WalletNamespace } from "@solana/kit-plugin-wallet";
import type { WalletProvider } from "../demo/providers";
import type { DemoAsset, SimulatedInvestment } from "../demo/types";
import { approvalMessage } from "../demo/approval-message";
import {
  DEMO_NETWORK,
  initialWalletSnapshot,
  walletErrorMessages,
  type ApprovalTransport,
  type WalletErrorCode,
  type WalletSnapshot,
} from "../demo/wallet-types";

function rejected(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? error.code : undefined;
  const message = "message" in error ? String(error.message) : "";
  return code === 4001 || /reject|denied|declined|cancel/i.test(message);
}

type WalletConnection = { wallet: WalletNamespace; dispose(): void };
function createWalletConnection(): WalletConnection {
  const client = createClient().use(
    walletSigner({
      chain: DEMO_NETWORK,
      autoConnect: false,
      storage: null,
      filter: (wallet) => wallet.features.includes("solana:signMessage"),
    }),
  );
  return { wallet: client.wallet, dispose: () => client[Symbol.dispose]() };
}

/** Browser-only lifecycle; construction and importing remain safe during SSR. */
export class SolanaWalletProvider implements WalletProvider {
  private snapshot: WalletSnapshot = initialWalletSnapshot;
  private listeners = new Set<() => void>();
  private namespace: WalletNamespace | null = null;
  private cleanup: (() => void) | null = null;
  private initialization: Promise<void> | null = null;
  private busy = false;
  private generation = 0;
  private disposed = false;
  private walletIds = new Map<object, string>();
  private nextId = 0;

  constructor(private readonly createConnection: () => WalletConnection = createWalletConnection) {}

  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private set(changes: Partial<WalletSnapshot>) {
    if (this.disposed) return;
    this.snapshot = { ...this.snapshot, ...changes };
    for (const listener of this.listeners) listener();
  }
  private fail(code: WalletErrorCode): never {
    const error = { code, message: walletErrorMessages[code] };
    this.set({ status: this.snapshot.address ? "connected" : "disconnected", error });
    throw new Error(error.message);
  }
  private sync = () => {
    if (!this.namespace) return;
    const state = this.namespace.getState();
    const account = state.connected?.account;
    const compatible =
      account?.chains.includes(DEMO_NETWORK) && account.features.includes("solana:signMessage");
    const address = compatible && account ? account.address : null;
    const previous = this.snapshot.address;
    const changed = previous !== address;
    if (changed) this.generation++;
    const wallets = state.wallets.map((wallet) => {
      let id = this.walletIds.get(wallet);
      if (!id) {
        id = `wallet-${++this.nextId}`;
        this.walletIds.set(wallet, id);
      }
      return { id, name: wallet.name };
    });
    const errorCode =
      previous && changed
        ? address
          ? "account_changed"
          : "wallet_disconnected"
        : state.connected && !compatible
          ? "wallet_unavailable"
          : null;
    this.set({
      wallets,
      address,
      status:
        !changed && (this.snapshot.status === "signing" || this.snapshot.status === "approved")
          ? this.snapshot.status
          : address
            ? "connected"
            : state.status === "connecting"
              ? "connecting"
              : "disconnected",
      ...(errorCode ? { error: { code: errorCode, message: walletErrorMessages[errorCode] } } : {}),
    });
  };
  private async initialize() {
    if (typeof window === "undefined" || this.disposed) this.fail("wallet_unavailable");
    if (!this.initialization)
      this.initialization = (async () => {
        const client = this.createConnection();
        this.namespace = client.wallet;
        const unsubscribe = client.wallet.subscribe(this.sync);
        this.cleanup = () => {
          unsubscribe();
          client.dispose();
        };
        await client.wallet.whenReady();
        this.sync();
      })();
    await this.initialization;
  }
  async discover() {
    this.set({ status: "discovering", error: null });
    try {
      await this.initialize();
      this.sync();
    } catch {
      this.fail("unexpected_error");
    }
    if (!this.snapshot.wallets.length) this.fail("wallet_unavailable");
    return this.snapshot.wallets;
  }
  async connect(walletId: string) {
    if (this.busy) return;
    this.busy = true;
    try {
      await this.initialize();
      const wallet = this.namespace!.getState().wallets.find(
        (candidate) => this.walletIds.get(candidate) === walletId,
      );
      if (!wallet) this.fail("wallet_unavailable");
      this.set({ status: "connecting", error: null });
      await this.namespace!.connect(wallet);
      this.sync();
      if (!this.snapshot.address) this.fail("wallet_unavailable");
      this.set({ status: "connected", error: null });
    } catch (error) {
      if (this.snapshot.error) throw error;
      this.fail(rejected(error) ? "connection_rejected" : "unexpected_error");
    } finally {
      this.busy = false;
    }
  }
  async disconnect() {
    if (this.busy) return;
    this.busy = true;
    this.generation++;
    this.set({ status: "disconnected", address: null, error: null });
    try {
      await this.namespace?.disconnect();
    } catch {
      this.fail("unexpected_error");
    } finally {
      this.busy = false;
    }
  }
  clearApproval() {
    this.generation++;
    this.set({ status: this.snapshot.address ? "connected" : "disconnected", error: null });
  }
  async signApproval(
    asset: DemoAsset,
    amount: number,
    transport: ApprovalTransport,
  ): Promise<SimulatedInvestment> {
    if (this.busy) throw new Error("An approval is already in progress.");
    const address = this.snapshot.address;
    if (!address || !this.namespace) this.fail("wallet_disconnected");
    this.busy = true;
    const generation = this.generation;
    let phase: "challenge" | "signature" | "verification" = "challenge";
    const assertCurrent = () => {
      if (this.disposed || generation !== this.generation || this.snapshot.address !== address)
        this.fail(this.snapshot.address ? "account_changed" : "wallet_disconnected");
    };
    this.set({ status: "signing", error: null });
    try {
      const challenge = await transport.issue({ asset, amount, walletAddress: address });
      assertCurrent();
      if (
        challenge.walletAddress !== address ||
        challenge.network !== DEMO_NETWORK ||
        challenge.asset.id !== asset.id ||
        challenge.asset.ticker !== asset.ticker ||
        challenge.amount !== amount ||
        challenge.origin !== window.location.origin ||
        Date.parse(challenge.expiresAt) <= Date.now()
      )
        this.fail("unexpected_error");
      phase = "signature";
      const signature = await this.namespace.signMessage(
        new TextEncoder().encode(approvalMessage(challenge)),
      );
      assertCurrent();
      phase = "verification";
      const result = await transport.verify({
        challengeId: challenge.id,
        walletAddress: address,
        signature: Array.from(signature),
      });
      assertCurrent();
      if (
        result.walletApproval !== "verified" ||
        result.walletAddress !== address ||
        result.network !== DEMO_NETWORK ||
        result.assetId !== asset.id ||
        result.amount !== amount
      )
        this.fail("unexpected_error");
      this.set({ status: "approved", error: null });
      return result;
    } catch (error) {
      if (this.snapshot.error) throw error;
      this.fail(
        phase === "signature" && rejected(error) ? "signature_rejected" : "unexpected_error",
      );
    } finally {
      this.busy = false;
    }
  }
  dispose() {
    this.disposed = true;
    this.generation++;
    this.cleanup?.();
    this.listeners.clear();
  }
}
