import type { AnswerResult } from "@/lib/ai/schemas";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleAlert,
  Minus,
  Plus,
  RotateCcw,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { PublishStrategyPanel } from "@/components/strategies/publish-strategy-panel";
import type { DemoAsset, DemoMessage, DemoState, SimulatedInvestment } from "@/lib/demo/types";

import type { WalletSnapshot } from "@/lib/demo/wallet-types";

const PORTFOLIO_VALUE = 1000;

function AssetCard({
  asset,
  onChange,
  onToggle,
  onInvest,
  investedAmount,
}: {
  asset: DemoAsset;
  onChange: (value: number) => void;
  onToggle: () => void;
  onInvest: () => void;
  investedAmount: number;
}) {
  const [details, setDetails] = useState(false);
  return (
    <article className={`demo-asset-card ${asset.active ? "" : "is-rejected"}`}>
      {investedAmount > 0 && (
        <p className="demo-disclaimer" role="status">
          Simulated investment: ${investedAmount.toLocaleString("en-US")}
        </p>
      )}
      <div className="demo-asset-top">
        <div className="demo-ticker">
          <span>{asset.ticker.slice(0, 2)}</span>
          <div>
            <strong>{asset.ticker}</strong>
            <small>{asset.name}</small>
          </div>
        </div>
        <span className="demo-category">{asset.category}</span>
      </div>
      <div className="demo-allocation">
        <span>Proposed allocation</span>
        <strong>{asset.allocation}%</strong>
        <small>${Math.round((PORTFOLIO_VALUE * asset.allocation) / 100)}</small>
      </div>
      <div className="demo-exposure">
        <span>WHAT IT REPRESENTS</span>
        <p>{asset.exposure}</p>
      </div>
      <button
        type="button"
        className="demo-details-toggle"
        onClick={() => setDetails((value) => !value)}
        aria-expanded={details}
      >
        View details <ChevronDown className={details ? "rotate-180" : ""} />
      </button>
      {details && (
        <div className="demo-details">
          <div>
            <span>WHY IT'S HERE</span>
            <p>{asset.why}</p>
          </div>
          <div>
            <span>KNOWN RISKS</span>
            <p>{asset.risks}</p>
          </div>
          <div>
            <span>AVAILABILITY</span>
            <p>{asset.availability}</p>
          </div>
        </div>
      )}
      <div className="demo-asset-actions">
        {asset.active ? (
          <>
            <div className="demo-stepper">
              <Button
                variant="icon"
                size="icon-sm"
                aria-label={`Decrease ${asset.ticker}`}
                onClick={() => onChange(Math.max(0, asset.allocation - 5))}
              >
                <Minus />
              </Button>
              <label>
                <span className="sr-only">Edit {asset.ticker} percentage</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={asset.allocation}
                  onChange={(event) =>
                    onChange(Math.min(100, Math.max(0, Number(event.target.value))))
                  }
                />
                %
              </label>
              <Button
                variant="icon"
                size="icon-sm"
                aria-label={`Increase ${asset.ticker}`}
                onClick={() => onChange(Math.min(100, asset.allocation + 5))}
              >
                <Plus />
              </Button>
            </div>
            <Button variant="ghost" size="sm" onClick={onToggle}>
              <X /> Reject
            </Button>
            <Button
              size="sm"
              disabled={Math.round((PORTFOLIO_VALUE * asset.allocation) / 100) <= 0}
              onClick={onInvest}
            >
              {investedAmount > 0 ? "Simulate again" : "Invest"}
            </Button>
          </>
        ) : (
          <Button variant="outline" size="sm" onClick={onToggle}>
            <RotateCcw /> Undo
          </Button>
        )}
      </div>
    </article>
  );
}

export function CompositionWorkspace({
  state,
  onState,
  onAsk,
  onSimulate,
  onTrack,
  tracking,
  wallet,
  walletReady,
  onConnect,
  onDisconnect,
  onClearApproval,
}: {
  wallet: WalletSnapshot;
  walletReady: boolean;
  onConnect: (walletId?: string) => Promise<boolean>;
  onDisconnect: () => Promise<void>;
  onClearApproval: () => void;
  state: DemoState;
  onState: (state: DemoState) => void;
  onAsk: (question: string) => Promise<AnswerResult>;
  onSimulate: (asset: DemoAsset, amount: number) => Promise<SimulatedInvestment>;
  onTrack: () => void;
  tracking: boolean;
}) {
  const [approving, setApproving] = useState(false);
  const approvalLock = useRef(false);
  const [approvalError, setApprovalError] = useState("");
  const [result, setResult] = useState<SimulatedInvestment | null>(null);
  const connected = Boolean(wallet.address);
  const walletBusy =
    wallet.status === "connecting" ||
    wallet.status === "discovering" ||
    wallet.status === "signing";
  const abbreviatedAddress = wallet.address
    ? `${wallet.address.slice(0, 4)}...${wallet.address.slice(-4)}`
    : "No wallet connected";
  useEffect(() => {
    if (wallet.status !== "approved") {
      setResult(null);
      setReviewStep((current) => (current === "success" ? "review" : current));
    }
  }, [wallet.status, wallet.address]);
  const [selected, setSelected] = useState<DemoAsset | null>(null);
  const [reviewStep, setReviewStep] = useState<"review" | "approval" | "success">("review");
  const [askMessages, setAskMessages] = useState<DemoMessage[]>([]);
  const [asking, setAsking] = useState(false);
  const askLock = useRef(false);
  const [askError, setAskError] = useState("");
  const [proposal, setProposal] = useState<{ assets: DemoAsset[]; base: string } | null>(null);
  const allocationKey = JSON.stringify(
    state.assets.map(({ id, allocation, active }) => ({ id, allocation, active })),
  );
  const allocationRef = useRef(allocationKey);
  allocationRef.current = allocationKey;
  const total = useMemo(
    () =>
      state.assets
        .filter((asset) => asset.active)
        .reduce((sum, asset) => sum + asset.allocation, 0),
    [state.assets],
  );
  const amount = selected ? Math.round((PORTFOLIO_VALUE * selected.allocation) / 100) : 0;
  const updateAsset = (id: string, changes: Partial<DemoAsset>) =>
    onState({
      ...state,
      assets: state.assets.map((asset) => (asset.id === id ? { ...asset, ...changes } : asset)),
    });
  const ask = async (question: string) => {
    const clean = question.trim();
    if (!clean || askLock.current) return;
    askLock.current = true;
    setAskError("");
    setProposal(null);
    const base = allocationKey;
    setAskMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", text: clean },
    ]);
    setAsking(true);
    try {
      const answer = await onAsk(clean);
      const text = [answer.explanation, ...answer.limitations].join("\n\n");
      if (answer.proposedAssets && allocationRef.current === base)
        setProposal({ assets: answer.proposedAssets, base });
      else if (answer.proposedAssets)
        setAskError(
          "The composition changed while VicTy was responding. Ask again to review an updated proposal.",
        );
      setAskMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "assistant", text },
      ]);
    } catch (error) {
      setAskError(
        error instanceof Error ? error.message : "VicTy could not answer. Please try again.",
      );
    } finally {
      askLock.current = false;
      setAsking(false);
    }
  };
  const invest = async () => {
    if (!selected || amount <= 0 || approvalLock.current || walletBusy) return;
    setApprovalError("");
    if (!connected) {
      if (await onConnect()) setReviewStep("approval");
      return;
    }
    if (reviewStep === "review") {
      setReviewStep("approval");
      return;
    }
    approvalLock.current = true;
    setApproving(true);
    setResult(null);
    try {
      const verified = await onSimulate(selected, amount);
      onState({ ...state, investments: [...state.investments, verified] });
      setResult(verified);
      setReviewStep("success");
    } catch (error) {
      setApprovalError(
        error instanceof Error
          ? error.message
          : "Approval could not be completed. Please try again.",
      );
      setReviewStep("approval");
    } finally {
      approvalLock.current = false;
      setApproving(false);
    }
  };
  const close = () => {
    if (approvalLock.current || walletBusy) return;
    setSelected(null);
    setReviewStep("review");
    setApprovalError("");
    setResult(null);
    onClearApproval();
  };
  const walletHelp = (
    <div className="demo-disclaimer">
      {!connected && (
        <p>
          No wallet yet?{" "}
          <a
            href="https://phantom.com/download"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Download Phantom
          </a>{" "}
          and set it up, then refresh this page to connect.
        </p>
      )}
      <p>
        If you have already authorized VicTy in your wallet, connecting may not open a new approval
        window. Signing the demo message is a separate step.
      </p>
      <p>
        In Phantom, open your profile → Settings → Developer Settings, enable Testnet Mode and
        select Solana Devnet. This demo only asks you to sign a message. No SOL or deposit is
        needed.{" "}
        <a
          href="https://help.phantom.com/articles/28951369255699"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          Setup guide
        </a>
      </p>
    </div>
  );

  const walletChoices =
    !connected && wallet.wallets.length > 1 ? (
      <div className="demo-summary-list" aria-label="Choose a wallet">
        {wallet.wallets.map((choice) => (
          <Button
            key={choice.id}
            variant="outline"
            size="sm"
            disabled={walletBusy || approving}
            onClick={() => void onConnect(choice.id)}
          >
            {choice.name}
          </Button>
        ))}
      </div>
    ) : null;
  return (
    <>
      <div className="demo-workspace">
        <div className="demo-workspace-main">
          <div className="demo-section-heading">
            <p className="eyebrow">THESIS → COMPOSITION</p>
            <h1>
              How this thesis
              <br />
              can be represented
            </h1>
            <p>This is a proposed composition for exploration. Nothing has been bought.</p>
            {state.compositionSummary && <p>{state.compositionSummary}</p>}
            {state.limitations?.map((limitation, index) => (
              <p className="demo-disclaimer" key={index}>
                {limitation}
              </p>
            ))}
          </div>
          <div className="demo-asset-grid">
            {state.assets.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                investedAmount={state.investments
                  .filter((investment) => investment.assetId === asset.id)
                  .reduce((total, investment) => total + investment.amount, 0)}
                onChange={(allocation) => updateAsset(asset.id, { allocation })}
                onToggle={() => updateAsset(asset.id, { active: !asset.active })}
                onInvest={() => {
                  onClearApproval();
                  setApprovalError("");
                  setResult(null);
                  setSelected(asset);
                  setReviewStep("review");
                }}
              />
            ))}
          </div>
          <section className="demo-ask">
            <p className="eyebrow">ASK VICTY</p>
            <h2>Ask VicTy about this composition</h2>
            <div className="demo-suggestions">
              {[
                `Why is ${state.assets.find((a) => a.active)?.ticker ?? "this asset"} here?`,
                "What are the main risks in this composition?",
                "Make this less volatile.",
                "Can this thesis be represented only with tokenized RWAs?",
              ].map((q) => (
                <Button key={q} variant="outline" size="sm" onClick={() => void ask(q)}>
                  {q}
                </Button>
              ))}
            </div>
            {askMessages.length > 0 && (
              <div className="demo-ask-messages">
                {askMessages.map((message) => (
                  <Message key={message.id} from={message.role}>
                    <MessageContent>
                      {message.role === "assistant" ? (
                        <MessageResponse>{message.text}</MessageResponse>
                      ) : (
                        message.text
                      )}
                    </MessageContent>
                  </Message>
                ))}
                {asking && (
                  <Shimmer className="text-muted-foreground">Reviewing composition...</Shimmer>
                )}
              </div>
            )}
            {askError && (
              <p className="demo-error" role="alert">
                {askError}
              </p>
            )}
            {proposal && (
              <div className="demo-summary-list">
                <p className="demo-disclaimer">Proposed changes — nothing has been applied.</p>
                {proposal.assets.map((asset) => (
                  <div key={asset.id}>
                    <span>{asset.ticker}</span>
                    <b>{asset.allocation}%</b>
                  </div>
                ))}
                <Button
                  disabled={proposal.base !== allocationKey || asking || approving || walletBusy}
                  onClick={() => {
                    if (proposal.base !== allocationKey) return;
                    onClearApproval();
                    onState({ ...state, assets: proposal.assets });
                    setProposal(null);
                  }}
                >
                  Apply proposal
                </Button>
                <Button variant="ghost" onClick={() => setProposal(null)}>
                  Dismiss
                </Button>
              </div>
            )}
            <PromptInput onSubmit={({ text }) => ask(text)}>
              <PromptInputTextarea
                maxLength={1000}
                placeholder="Ask about an allocation, risk or alternative…"
              />
              <PromptInputFooter className="justify-end">
                <PromptInputSubmit status={asking ? "submitted" : "ready"} disabled={asking} />
              </PromptInputFooter>
            </PromptInput>
          </section>
        </div>
        <aside className="demo-summary">
          <div>
            <span className="mono-label">COMPOSITION TOTAL</span>
            <strong className={total === 100 ? "" : "is-warning"}>{total}%</strong>
            <div className="demo-total-track">
              <span style={{ width: `${Math.min(total, 100)}%` }} />
            </div>
            {total === 100 ? (
              <p className="demo-total-ok">
                <Check /> Fully allocated
              </p>
            ) : (
              <p className="demo-total-warning">
                <CircleAlert />{" "}
                {total < 100 ? `${100 - total}% unallocated` : `${total - 100}% overallocated`}
              </p>
            )}
          </div>
          <div className="demo-summary-list">
            {state.assets
              .filter((asset) => asset.active)
              .map((asset) => (
                <div key={asset.id}>
                  <span>{asset.ticker}</span>
                  <b>{asset.allocation}%</b>
                </div>
              ))}
          </div>
          <div className="demo-wallet">
            <div className="demo-wallet-head">
              <Wallet />
              <div>
                <strong>{connected ? "Connected" : "Demo wallet"}</strong>
                <span>{abbreviatedAddress} · Solana Devnet</span>
              </div>
            </div>
            <Button
              variant={connected ? "outline" : "default"}
              size="sm"
              disabled={!walletReady || walletBusy || approving}
              onClick={() => {
                if (connected) void onDisconnect();
                else void onConnect();
              }}
            >
              {wallet.status === "connecting"
                ? "Connecting…"
                : wallet.status === "discovering"
                  ? "Discovering wallets…"
                  : connected
                    ? "Disconnect"
                    : "Connect wallet"}
            </Button>
            {walletChoices}
            {walletHelp}
            {wallet.error && (
              <p className="demo-error" role="alert">
                {wallet.error.message}
              </p>
            )}
          </div>
          <p className="demo-disclaimer">Demo only. No real asset purchase will occur.</p>
        </aside>
      </div>
      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <DialogContent className="demo-review-dialog">
          {selected && (
            <>
              {reviewStep === "success" && result && wallet.status === "approved" ? (
                <div className="demo-invest-success">
                  <span>
                    <Check />
                  </span>
                  <p className="eyebrow">WALLET APPROVAL VERIFIED</p>
                  <DialogTitle>Investment simulated</DialogTitle>
                  <DialogDescription>
                    No real asset purchase occurred. Your wallet signed an off-chain demo approval;
                    no transaction was sent.
                  </DialogDescription>
                  <div className="demo-review-grid">
                    <div>
                      <small>ASSET</small>
                      <strong>{selected.ticker}</strong>
                    </div>
                    <div>
                      <small>ALLOCATION</small>
                      <strong>${amount}</strong>
                    </div>
                    <div>
                      <small>EXECUTION PROVIDER</small>
                      <strong>Jupiter demo</strong>
                    </div>
                    <div>
                      <small>WALLET STATUS</small>
                      <strong>{abbreviatedAddress} · Solana Devnet</strong>
                    </div>
                  </div>
                  <div className="demo-track-message">
                    <strong>Your wallet approval was verified.</strong>
                    <p>Save this composition to track its simulated performance.</p>
                  </div>
                  <PublishStrategyPanel state={state} />
                  <Button onClick={onTrack} disabled={tracking}>
                    {tracking ? "Opening your thesis…" : "Save strategy & track"} <ArrowRight />
                  </Button>
                  <Button variant="ghost" onClick={close}>
                    Return to composition
                  </Button>
                </div>
              ) : (
                <>
                  <DialogHeader>
                    <p className="eyebrow">
                      {reviewStep === "review" ? "DEMO INVESTMENT" : "WALLET APPROVAL"}
                    </p>
                    <DialogTitle>{selected.ticker}</DialogTitle>
                    <DialogDescription>
                      {reviewStep === "review"
                        ? "Review this demo investment. No real asset purchase will occur."
                        : "Sign a message for this simulated investment. Solana Devnet context only; no funds or transaction fees."}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="demo-review-grid">
                    <div>
                      <small>PLANNED ALLOCATION</small>
                      <strong>${amount}</strong>
                    </div>
                    <div>
                      <small>EXECUTION PROVIDER</small>
                      <strong>Jupiter demo</strong>
                    </div>
                    <div>
                      <small>ROUTE</small>
                      <strong>USDC → {selected.ticker}</strong>
                    </div>
                    <div>
                      <small>ESTIMATED EXECUTION</small>
                      <strong>${amount}</strong>
                    </div>
                  </div>
                  <div className="demo-route-warning">
                    Demo route — no real asset purchase will occur.
                  </div>
                  {walletChoices}
                  {walletHelp}
                  {(wallet.error || approvalError) && (
                    <p className="demo-error" role="alert">
                      {wallet.error?.message ?? approvalError}
                    </p>
                  )}
                  <DialogFooter>
                    <Button variant="outline" disabled={approving || walletBusy} onClick={close}>
                      Cancel
                    </Button>
                    <Button
                      disabled={!walletReady || approving || walletBusy || amount <= 0}
                      onClick={() => void invest()}
                    >
                      {approving
                        ? "Waiting for wallet approval..."
                        : wallet.status === "connecting"
                          ? "Connecting…"
                          : !connected
                            ? "Connect wallet"
                            : reviewStep === "review"
                              ? "Review approval"
                              : "Approve simulation"}
                    </Button>
                  </DialogFooter>
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
