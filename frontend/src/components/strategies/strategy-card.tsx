import { ArrowRight, Users } from "lucide-react";
import type { PublicStrategy } from "@/lib/strategies/types";

export function StrategyCard({ strategy, onOpen }: { strategy: PublicStrategy; onOpen?: (strategy: PublicStrategy) => void }) {
  const positive = strategy.simulatedPerformance >= 0;
  return (
    <article className="strategy-card">
      <div className="strategy-card-head">
        <span className="strategy-avatar" aria-hidden="true">{strategy.creatorName.charAt(0).toUpperCase()}</span>
        <div>
          <strong>@{strategy.creatorHandle}</strong>
          <small>{strategy.creatorName}</small>
        </div>
        <span className="strategy-badge">{strategy.isDemo ? "DEMO" : "PUBLISHED · THIS SESSION"}</span>
      </div>
      <h3>{strategy.title}</h3>
      <p>{strategy.thesisSummary}</p>
      <div className="strategy-themes">{strategy.themes.map((theme) => <span key={theme}>{theme}</span>)}</div>
      <div className="strategy-stats">
        <div><small>SIMULATED PERFORMANCE</small><b className={positive ? "is-up" : "is-down"}>{positive ? "+" : ""}{strategy.simulatedPerformance.toFixed(1)}%</b></div>
        <div><small>FOLLOWERS · DEMO</small><b><Users className="size-3.5" /> {strategy.followers.toLocaleString("en-US")}</b></div>
        <div><small>STATUS</small><b>Public</b></div>
      </div>
      {onOpen && (
        <button type="button" className="strategy-open" onClick={() => onOpen(strategy)}>
          View strategy <ArrowRight className="size-4" />
        </button>
      )}
    </article>
  );
}
