import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { PublicStrategy } from "@/lib/strategies/types";

export function StrategyPreviewDialog({
  strategy,
  onClose,
  onUseAsInspiration,
}: {
  strategy: PublicStrategy | null;
  onClose: () => void;
  onUseAsInspiration?: (strategy: PublicStrategy) => void;
}) {
  return (
    <Dialog open={Boolean(strategy)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="strategy-preview">
        {strategy && (
          <>
            <DialogHeader>
              <p className="eyebrow">@{strategy.creatorHandle} · {strategy.isDemo ? "DEMO STRATEGY" : "PUBLISHED THIS SESSION"}</p>
              <DialogTitle>{strategy.title}</DialogTitle>
              <DialogDescription>{strategy.thesisSummary}</DialogDescription>
            </DialogHeader>
            <section>
              <span className="mono-label">EXPOSURES</span>
              <ul className="strategy-list">{strategy.exposures.map((e) => <li key={e.name}><span>{e.name}</span><b>{e.weight}%</b></li>)}</ul>
            </section>
            {strategy.composition.length > 0 && (
              <section>
                <span className="mono-label">COMPOSITION · ILLUSTRATIVE</span>
                <ul className="strategy-list">{strategy.composition.map((a) => <li key={a.ticker}><span><strong>{a.ticker}</strong> {a.name}</span><b>{a.allocation}%</b></li>)}</ul>
              </section>
            )}
            <section><span className="mono-label">RATIONALE</span><p>{strategy.rationale}</p></section>
            <section><span className="mono-label">KNOWN RISKS</span><p>{strategy.risks.join(" · ")}</p></section>
            <section>
              <span className="mono-label">SIMULATED PERFORMANCE</span>
              <p><b>{strategy.simulatedPerformance >= 0 ? "+" : ""}{strategy.simulatedPerformance.toFixed(1)}%</b> — demo data, not a real or expected return.</p>
            </section>
            <div className="strategy-preview-actions">
              {onUseAsInspiration ? (
                <Button onClick={() => onUseAsInspiration(strategy)}>Use as inspiration <ArrowRight /></Button>
              ) : (
                <Button asChild><Link to="/demo">Use as inspiration <ArrowRight /></Link></Button>
              )}
              <Button variant="secondary" asChild><Link to="/demo" search={{ fresh: true }} onClick={onClose}>Build your own thesis</Link></Button>
              <Button variant="ghost" disabled>Follow · Coming soon</Button>
              <Button variant="ghost" disabled>Fork · Coming soon</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
