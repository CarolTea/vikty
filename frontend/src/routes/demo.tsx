import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowRight, Check, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { VicTyLogo } from "@/components/victy-logo";
import victyFrontAsset from "@/assets/victy-front-transparent.png.asset.json";
import { DemoChat } from "@/components/demo/demo-chat";
import { CompositionWorkspace } from "@/components/demo/composition-workspace";
import {
  askAboutComposition,
  clarifyThesis,
  createDemoSession,
  generateComposition,
  interpretThesis,
  saveDemoSession,
} from "@/lib/demo.functions";
import { emptyDemoState, type DemoSessionCredentials, type DemoState } from "@/lib/demo/types";
import { useDemoWallet } from "@/hooks/use-demo-wallet";
import { issueWalletApproval, verifyWalletApproval } from "@/lib/wallet-approval.functions";
import { supabase } from "@/integrations/supabase/client";
import { StrategyCard } from "@/components/strategies/strategy-card";
import { StrategyPreviewDialog } from "@/components/strategies/strategy-preview-dialog";
import { demoStrategies } from "@/lib/strategies/mock-strategies";
import { usePublishedStrategies } from "@/lib/strategies/session-store";
import type { PublicStrategy } from "@/lib/strategies/types";

const STORAGE_KEY = "victy_demo_session_v1";
const examples = [
  "I believe AI infrastructure will keep growing.",
  "I believe tokenized real-world assets will become part of mainstream finance.",
  "I believe demand for energy will increase because of AI.",
  "I believe stablecoins will become global payment infrastructure.",
];

export const Route = createFileRoute("/demo")({
  validateSearch: (search: Record<string, unknown>): { fresh?: boolean | undefined } => ({
    fresh: search["fresh"] === true || search["fresh"] === "true" ? true : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Interactive Product Demo — VicTy" },
      {
        name: "description",
        content:
          "Explore how VicTy translates a belief into an understandable investment thesis and proposed asset composition.",
      },
      { property: "og:title", content: "Interactive Product Demo — VicTy" },
      {
        property: "og:description",
        content: "Turn a belief into a thesis, exposures and a composition you control.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DemoPage,
});

function DemoPage() {
  const navigate = useNavigate();
  const { fresh } = Route.useSearch();
  const initialized = useRef(false);
  const resetLock = useRef(false);
  const trackLock = useRef(false);
  const aiLock = useRef(false);
  const syncQueue = useRef(Promise.resolve());
  const [tracking, setTracking] = useState(false);
  const createSession = useServerFn(createDemoSession);
  const saveSession = useServerFn(saveDemoSession);
  const clarify = useServerFn(clarifyThesis);
  const interpret = useServerFn(interpretThesis);
  const compose = useServerFn(generateComposition);
  const ask = useServerFn(askAboutComposition);
  const issueApproval = useServerFn(issueWalletApproval);
  const verifyApproval = useServerFn(verifyWalletApproval);
  const { provider, wallet } = useDemoWallet();
  const [state, setState] = useState<DemoState>(emptyDemoState);
  const [credentials, setCredentials] = useState<DemoSessionCredentials | null>(null);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const published = usePublishedStrategies();
  const [preview, setPreview] = useState<PublicStrategy | null>(null);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [state.step]);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    void (async () => {
      try {
        const created = await createSession();
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ ...created, state: emptyDemoState }),
        );
        setCredentials(created);
        window.localStorage.removeItem("victy_pending_save");
        window.localStorage.removeItem("victy_pending_user");
        window.localStorage.removeItem("victy_pending_name");
        if (fresh) {
          await navigate({ to: "/demo", search: {}, replace: true });
        }
      } catch {
        setError("The demo session could not be prepared. Please refresh and try again.");
      } finally {
        setReady(true);
      }
    })();
  }, [createSession, fresh, navigate]);
  const updateState = useCallback(
    (next: DemoState) => {
      setState(next);
      if (credentials) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...credentials, state: next }));
        syncQueue.current = syncQueue.current
          .then(async () => {
            const result = await saveSession({ data: { ...credentials, state: next } });
            if (!result.ok) throw new Error("Demo sync failed");
          })
          .catch(() => {
            setError(
              "Your progress is saved in this browser, but could not sync. Please try again before switching devices.",
            );
          });
      }
    },
    [credentials, saveSession],
  );
  const explainError = (error: unknown) =>
    setError(
      error instanceof Error
        ? error.message
        : "VicTy could not complete this request. Please try again.",
    );
  const begin = async (belief: string) => {
    if (aiLock.current || !credentials) return;
    const clean = belief.trim();
    if (clean.length < 10) {
      setError("Describe your belief in a little more detail.");
      return;
    }
    aiLock.current = true;
    setPending(true);
    setError("");
    try {
      const result = await clarify({
        data: { credentials, belief: clean, count: 0, messages: [] },
      });
      const next = {
        ...state,
        belief: clean,
        messages: result.messages,
        clarificationCount: result.ready ? 0 : 1,
      };
      if (result.ready) {
        const understood = await interpret({
          data: { credentials, belief: clean, messages: result.messages },
        });
        updateState({ ...next, step: "interpretation", ...understood });
      } else updateState({ ...next, step: "conversation" });
    } catch (error) {
      explainError(error);
    } finally {
      aiLock.current = false;
      setPending(false);
    }
  };
  const reply = async (answer: string) => {
    if (aiLock.current || !credentials) return;
    aiLock.current = true;
    setPending(true);
    setError("");
    try {
      const result = await clarify({
        data: {
          credentials,
          belief: state.belief,
          answer,
          count: state.clarificationCount,
          messages: state.messages.slice(-8),
        },
      });
      const messages = [...state.messages, ...result.messages];
      if (result.ready) {
        const understood = await interpret({
          data: { credentials, belief: state.belief, messages: messages.slice(-8) },
        });
        updateState({ ...state, step: "interpretation", messages, ...understood });
      } else updateState({ ...state, messages, clarificationCount: state.clarificationCount + 1 });
    } catch (error) {
      explainError(error);
    } finally {
      aiLock.current = false;
      setPending(false);
    }
  };
  const build = async () => {
    if (aiLock.current || !credentials) return;
    aiLock.current = true;
    setPending(true);
    setError("");
    try {
      const result = await compose({
        data: {
          credentials,
          belief: state.belief,
          interpretation: {
            summary: state.interpretation,
            exposures: state.exposures.map((e) => ({
              ...e,
              importance: e.importance ?? "primary",
            })),
            limitations: state.limitations ?? [],
          },
        },
      });
      updateState({ ...state, step: "composition", ...result });
    } catch (error) {
      explainError(error);
    } finally {
      aiLock.current = false;
      setPending(false);
    }
  };
  const reset = async () => {
    if (resetLock.current || pending || tracking || wallet.status === "signing") return;
    resetLock.current = true;
    setPending(true);
    setError("");
    try {
      const created = await createSession();
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...created, state: emptyDemoState }),
      );
      window.localStorage.removeItem("victy_pending_save");
      window.localStorage.removeItem("victy_pending_user");
      window.localStorage.removeItem("victy_pending_name");
      setCredentials(created);
      setState(emptyDemoState);
      setDraft("");
      provider?.clearApproval();
    } catch {
      setError(
        "A new demo could not be created. Your previous demo is still available. Please try again.",
      );
    } finally {
      resetLock.current = false;
      setPending(false);
    }
  };
  if (!ready)
    return (
      <main className="demo-page demo-loading">
        <VicTyLogo />
        <p>Preparing your demo…</p>
      </main>
    );
  return (
    <main className="demo-page">
      <header className="demo-header">
        <Link to="/" aria-label="Back to VicTy home">
          <VicTyLogo />
        </Link>
        <div className="demo-progress" aria-label="Demo progress">
          {["Belief", "Refine", "Interpret", "Compose"].map((label, index) => (
            <span
              key={label}
              className={
                (state.step === "input"
                  ? 0
                  : state.step === "conversation"
                    ? 1
                    : state.step === "interpretation"
                      ? 2
                      : 3) >= index
                  ? "is-active"
                  : ""
              }
            >
              <i>
                {index <
                (state.step === "input"
                  ? 0
                  : state.step === "conversation"
                    ? 1
                    : state.step === "interpretation"
                      ? 2
                      : 3) ? (
                  <Check />
                ) : (
                  index + 1
                )}
              </i>
              {label}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/dashboard">My strategies</Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={pending || tracking || wallet.status === "signing"}
            onClick={() => void reset()}
          >
            <RotateCcw /> Start over
          </Button>
        </div>
      </header>
      {error && (
        <div className="demo-error" role="alert">
          {error}
        </div>
      )}
      {state.step === "input" && (
        <section className="demo-intro">
          <div className="demo-intro-copy">
            <p className="eyebrow">
              <span className="signal-dot" /> INTERACTIVE PRODUCT DEMO
            </p>
            <h1>
              What do you
              <br />
              <span className="gradient-text">believe in?</span>
            </h1>
            <div className="demo-intro-welcome">
              <img
                src={victyFrontAsset.url}
                alt="VicTy mascot wearing sunglasses with her arms crossed"
                width={1024}
                height={1024}
                loading="lazy"
                decoding="async"
                className="demo-intro-mascot"
              />
              <p>
                Describe a belief about the future. VicTy will help translate it into an investment
                thesis you can understand and explore.
              </p>
            </div>
          </div>
          <div className="demo-belief-entry">
            <label htmlFor="belief">YOUR BELIEF</label>
            <textarea
              id="belief"
              autoFocus
              maxLength={2000}
              value={draft}
              onChange={(event) => {
                setDraft(event.currentTarget.value);
                setError("");
              }}
              placeholder="I believe…"
            />
            <Button
              size="lg"
              disabled={pending || draft.trim().length < 10}
              onClick={() => void begin(draft)}
            >
              Explore this thesis <ArrowRight />
            </Button>
          </div>
          <div className="demo-examples">
            <span>OR START WITH AN EXAMPLE</span>
            <small className="mono-label">THESIS EXAMPLES</small>
            {examples.map((example) => (
              <button type="button" key={example} onClick={() => setDraft(example)}>
                {example}
                <ArrowRight />
              </button>
            ))}
            <small className="mono-label demo-strategies-label">OR EXPLORE A PUBLIC STRATEGY</small>
            <div className="strategy-grid">
              {[...published, ...demoStrategies].map((strategy) => (
                <StrategyCard key={strategy.id} strategy={strategy} onOpen={setPreview} />
              ))}
            </div>
          </div>
          <StrategyPreviewDialog
            strategy={preview}
            onClose={() => setPreview(null)}
            onUseAsInspiration={(strategy) => {
              setDraft(`I believe ${strategy.thesisSummary.charAt(0).toLowerCase()}${strategy.thesisSummary.slice(1)}`);
              setPreview(null);
            }}
          />
        </section>
      )}
      {state.step === "conversation" && (
        <section className="demo-flow">
          <div className="demo-flow-copy">
            <p className="eyebrow">REFINE THE THESIS</p>
            <h1>
              A clearer belief
              <br />
              creates a clearer structure.
            </h1>
            <p>VicTy asks only what is needed to understand the conviction behind your idea.</p>
          </div>
          <DemoChat messages={state.messages} pending={pending} onReply={reply} />
        </section>
      )}
      {state.step === "interpretation" && (
        <section className="demo-interpret">
          <div className="demo-interpret-main">
            <p className="eyebrow">THESIS INTERPRETATION</p>
            <h1>
              Here’s how I understand
              <br />
              <span className="gradient-text">your thesis.</span>
            </h1>
            <blockquote>{state.interpretation}</blockquote>
            {state.limitations?.map((limitation, index) => (
              <p className="demo-disclaimer" key={index}>
                {limitation}
              </p>
            ))}
            <div className="demo-interpret-actions">
              <Button size="lg" onClick={() => void build()} disabled={pending}>
                {pending ? "Building…" : "Build a composition"}
                <ArrowRight />
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => updateState({ ...state, step: "conversation" })}
              >
                <ArrowLeft /> Adjust thesis
              </Button>
            </div>
          </div>
          <div className="demo-exposure-stack">
            {state.exposures.map((exposure, index) => (
              <article key={exposure.id}>
                <span>0{index + 1}</span>
                <div>
                  <strong>{exposure.name}</strong>
                  <p>{exposure.description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
      {state.step === "composition" && (
        <CompositionWorkspace
          state={state}
          onState={updateState}
          onAsk={async (question) => {
            if (!credentials) throw new Error("Demo session unavailable. Please refresh.");
            return ask({
              data: {
                credentials,
                question,
                state: {
                  belief: state.belief,
                  interpretation: state.interpretation,
                  exposures: state.exposures,
                  assets: state.assets.map(({ id, allocation, active }) => ({
                    id,
                    allocation,
                    active,
                  })),
                },
              },
            });
          }}
          wallet={wallet}
          walletReady={Boolean(provider)}
          onConnect={async (walletId) => {
            if (!provider) return false;
            try {
              if (walletId) await provider.connect(walletId);
              else {
                const choices = await provider.discover();
                if (choices.length === 1) await provider.connect(choices[0]!.id);
              }
              return Boolean(provider.getSnapshot().address);
            } catch {
              return false;
            }
          }}
          onDisconnect={async () => {
            try {
              await provider?.disconnect();
            } catch {
              /* Provider exposes a friendly error. */
            }
          }}
          onClearApproval={() => provider?.clearApproval()}
          onSimulate={async (asset, amount) => {
            if (!provider || !credentials)
              throw new Error("Your demo session is unavailable. Please refresh before approving.");
            return provider.signApproval(asset, amount, {
              issue: (input) => issueApproval({ data: { ...input, credentials } }),
              verify: (input) => verifyApproval({ data: { ...input, credentials } }),
            });
          }}
          tracking={tracking}
          onTrack={() => {
            if (trackLock.current || !credentials) return;
            trackLock.current = true;
            setTracking(true);
            window.localStorage.setItem("victy_pending_save", credentials.id);
            void supabase.auth
              .getUser()
              .then(async ({ data }) => {
                if (data.user) window.localStorage.setItem("victy_pending_user", data.user.id);
                else window.localStorage.removeItem("victy_pending_user");
                await navigate(
                  data.user ? { to: "/dashboard" } : { to: "/auth", search: { next: "save" } },
                );
              })
              .catch(() => setError("Could not open your thesis. Please try again."))
              .finally(() => {
                trackLock.current = false;
                setTracking(false);
              });
          }}
        />
      )}
    </main>
  );
}
