import { useState, type FormEvent } from "react";
import { Check, Lock, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { publishStrategy } from "@/lib/strategies/session-store";
import type { PublicStrategy } from "@/lib/strategies/types";
import type { DemoState } from "@/lib/demo/types";
import { StrategyPreviewDialog } from "./strategy-preview-dialog";

// Demonstration-only publish flow; nothing is sent to the backend.
export function PublishStrategyPanel({ state }: { state: DemoState }) {
  const [mode, setMode] = useState<"choose" | "private" | "form" | "live">("choose");
  const [fields, setFields] = useState({ title: "", description: state.belief.slice(0, 160), creator: "" });
  const [error, setError] = useState("");
  const [live, setLive] = useState<PublicStrategy | null>(null);
  const [preview, setPreview] = useState<PublicStrategy | null>(null);
  const [copied, setCopied] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const title = fields.title.trim();
    const creator = fields.creator.trim();
    if (title.length < 3 || creator.length < 2) { setError("Add a strategy name and your creator name."); return; }
    const active = state.assets.filter((a) => a.active);
    const strategy: PublicStrategy = {
      id: `session-${Date.now()}`,
      creatorHandle: creator.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 20) || "creator",
      creatorName: creator,
      title,
      thesisSummary: fields.description.trim() || state.belief,
      themes: state.exposures.slice(0, 4).map((e) => e.name),
      visibility: "public",
      simulatedPerformance: 0,
      followers: 0,
      isDemo: false,
      exposures: state.exposures.map((e) => ({ name: e.name, weight: Math.round(active.filter((a) => a.exposure === e.name).reduce((s, a) => s + a.allocation, 0)) })),
      composition: active.map((a) => ({ ticker: a.ticker, name: a.name, allocation: a.allocation })),
      rationale: state.compositionSummary || state.interpretation,
      risks: active.map((a) => a.risks).filter(Boolean).slice(0, 3),
    };
    publishStrategy(strategy);
    setLive(strategy);
    setMode("live");
  };

  const share = async () => {
    if (!live) return;
    try { await navigator.clipboard.writeText(`${live.title} by @${live.creatorHandle} on VicTy — ${live.thesisSummary}`); setCopied(true); } catch { setCopied(false); }
  };

  return (
    <div className="publish-panel">
      {mode === "choose" && (<>
        <span className="mono-label">WHAT HAPPENS TO THIS STRATEGY?</span>
        <div className="publish-actions">
          <Button variant="secondary" onClick={() => setMode("private")}><Lock /> Keep private</Button>
          <Button onClick={() => setMode("form")}>Publish strategy</Button>
        </div>
      </>)}
      {mode === "private" && <p><Lock className="inline size-4" /> This strategy stays private. <button type="button" className="link-button" onClick={() => setMode("form")}>Publish instead</button></p>}
      {mode === "form" && (
        <form onSubmit={submit} className="publish-form" noValidate>
          <label><span>Strategy name</span><input maxLength={80} value={fields.title} onChange={(e) => setFields({ ...fields, title: e.target.value })} placeholder="The Robotics Decade" /></label>
          <label><span>Short description</span><textarea maxLength={200} value={fields.description} onChange={(e) => setFields({ ...fields, description: e.target.value })} /></label>
          <label><span>Creator name</span><input maxLength={40} value={fields.creator} onChange={(e) => setFields({ ...fields, creator: e.target.value })} placeholder="Your name" /></label>
          <p className="publish-visibility"><span className="mono-label">VISIBILITY</span> Public</p>
          {error && <p className="text-destructive" role="alert">{error}</p>}
          <p className="form-note">Demo only — the published strategy disappears when you refresh.</p>
          <div className="publish-actions"><Button type="submit">Publish strategy</Button><Button type="button" variant="ghost" onClick={() => setMode("choose")}>Cancel</Button></div>
        </form>
      )}
      {mode === "live" && live && (
        <div role="status">
          <p className="publish-live"><Check className="size-4" /> <strong>Your strategy is live.</strong></p>
          <div className="publish-actions">
            <Button onClick={() => setPreview(live)}>View public strategy</Button>
            <Button variant="secondary" onClick={() => void share()}><Share2 /> {copied ? "Copied" : "Share"}</Button>
          </div>
        </div>
      )}
      <StrategyPreviewDialog strategy={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
