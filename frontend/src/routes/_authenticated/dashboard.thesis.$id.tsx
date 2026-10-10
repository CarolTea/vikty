import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { ChartContainer } from "@/components/ui/chart";
import { getMyThesis } from "@/lib/thesis.functions";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
export const Route = createFileRoute("/_authenticated/dashboard/thesis/$id")({
  head: () => ({
    meta: [
      { title: "Thesis detail — VicTy" },
      {
        name: "description",
        content: "Understand how your saved VicTy thesis is represented and moving.",
      },
      { property: "og:title", content: "Thesis detail — VicTy" },
      {
        property: "og:description",
        content: "How this simulated thesis is represented and moving.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ThesisPage,
});

function ThesisPage() {
  const { id } = Route.useParams();
  const { user } = Route.useRouteContext();
  const get = useServerFn(getMyThesis);
  const query = useQuery({
    queryKey: ["thesis", user.id, id],
    queryFn: () => get({ data: { id } }),
    retry: false,
  });
  const thesis = query.data;
  if (query.isLoading)
    return (
      <main className="dashboard-page">
        <DashboardHeader />
        <div className="dashboard-loading">Loading thesis…</div>
      </main>
    );
  if (query.isError)
    return (
      <main className="dashboard-page">
        <DashboardHeader />
        <div className="demo-error" role="alert">
          <p>
            {query.error instanceof Error
              ? query.error.message
              : "Your thesis could not be loaded. Please try again."}
          </p>
          <Button
            variant="outline"
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
          >
            Try again
          </Button>
        </div>
      </main>
    );
  if (!thesis)
    return (
      <main className="dashboard-page">
        <DashboardHeader />
        <div className="dashboard-empty">
          <h1>Thesis not found</h1>
          <p>This thesis is unavailable or does not belong to this account.</p>
          <Button asChild>
            <Link to="/dashboard">Back to my theses</Link>
          </Button>
        </div>
      </main>
    );
  const top = [...thesis.assets].sort(
    (a, b) => b.currentValue - b.initialValue - (a.currentValue - a.initialValue),
  );
  const explanation = `${top[0]?.ticker ?? "The leading exposure"} contributed most to the simulated movement of this thesis. ${top.at(-1)?.ticker ?? "Another exposure"} contributed least, while the composition remained spread across ${thesis.assets.length} exposures.`;
  return (
    <main className="dashboard-page">
      <DashboardHeader />
      <article className="thesis-detail">
        <Button asChild variant="ghost" size="sm">
          <Link to="/dashboard">
            <ArrowLeft /> My theses
          </Link>
        </Button>
        <header>
          <p className="eyebrow">
            <span className="signal-dot" /> DEMO PERFORMANCE
          </p>
          <h1>{thesis.title}</h1>
          <p>{thesis.belief}</p>
        </header>
        <section className="detail-section">
          <p className="demo-disclaimer" role="status">
            Your thesis is now being tracked.
          </p>
          <p className="eyebrow">YOUR THESIS</p>
          <h2>What you believe</h2>
          <blockquote>{thesis.interpretation}</blockquote>
        </section>
        <section className="detail-section">
          <p className="eyebrow">HOW IT’S REPRESENTED</p>
          <h2>The composition</h2>
          <div className="detail-assets">
            {thesis.assets.map((asset) => (
              <article key={asset.id}>
                <div className="demo-ticker">
                  <span>{asset.ticker.slice(0, 2)}</span>
                  <div>
                    <strong>{asset.ticker}</strong>
                    <small>{asset.name}</small>
                  </div>
                </div>
                <b>{asset.allocation}%</b>
                <div>
                  <span>WHAT IT REPRESENTS</span>
                  <p>{asset.exposure}</p>
                </div>
                <div>
                  <span>WHY IT’S HERE</span>
                  <p>{asset.why}</p>
                </div>
                <div>
                  <span>KNOWN RISKS</span>
                  <p>{asset.risks}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="detail-section">
          <p className="eyebrow">HOW IT’S MOVING</p>
          <h2>Simulated direction over time</h2>
          <div className="detail-performance">
            <div className="performance-metrics">
              <div>
                <span>CURRENT SIMULATED VALUE</span>
                <strong>{money.format(thesis.currentValue)}</strong>
              </div>
              <div>
                <span>SINCE CREATED</span>
                <strong className={thesis.performancePercent >= 0 ? "is-positive" : "is-negative"}>
                  {thesis.performancePercent >= 0 ? "+" : ""}
                  {thesis.performancePercent.toFixed(1)}%
                </strong>
              </div>
              <div>
                <span>TODAY’S SIMULATED CHANGE</span>
                <strong className={thesis.todayPercent >= 0 ? "is-positive" : "is-negative"}>
                  {thesis.todayPercent >= 0 ? "+" : ""}
                  {thesis.todayPercent.toFixed(1)}%
                </strong>
              </div>
            </div>
            <ChartContainer
              config={{ value: { label: "Simulated value", color: "var(--signal)" } }}
              className="performance-chart"
            >
              <LineChart data={thesis.snapshots}>
                <XAxis dataKey="date" hide />
                <YAxis hide domain={["dataMin - 20", "dataMax + 20"]} />
                <Tooltip
                  formatter={(value) => money.format(Number(value))}
                  labelFormatter={(label) =>
                    new Date(`${label}T00:00:00`).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  }
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="var(--signal)"
                  strokeWidth={2.5}
                  dot={false}
                />
              </LineChart>
            </ChartContainer>
          </div>
        </section>
        <div className="detail-two-column">
          <section className="detail-section">
            <p className="eyebrow">WHAT CHANGED?</p>
            <h2>Why it moved</h2>
            <p className="detail-explanation">{explanation}</p>
          </section>
          <section className="detail-section">
            <p className="eyebrow">ASSET CONTRIBUTION</p>
            <h2>What shaped the result</h2>
            <div className="contribution-list">
              {top.map((asset, index) => (
                <div key={asset.id}>
                  <strong>{asset.ticker}</strong>
                  <span>
                    {index === 0
                      ? "Largest positive contributor"
                      : index === top.length - 1
                        ? "Lowest contribution"
                        : `${asset.exposure} exposure`}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
        <p className="demo-disclaimer">
          All values and changes shown here are simulated demo data, not live market prices or
          financial advice.
        </p>
      </article>
    </main>
  );
}
