import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { listMyTheses, saveTrackedThesis } from "@/lib/thesis.functions";
import type { DemoSessionCredentials, DemoState } from "@/lib/demo/types";

const DEMO_KEY = "victy_demo_session_v1";
const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "My theses — VicTy" },
      {
        name: "description",
        content: "Review your saved VicTy demo theses and simulated performance.",
      },
      { property: "og:title", content: "My theses — VicTy" },
      { property: "og:description", content: "Your ideas, translated into positions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardRoute,
});

function DashboardRoute() {
  const isIndex = useRouterState({
    select: (state) => state.matches.at(-1)?.routeId === Route.id,
  });
  return isIndex ? <DashboardPage /> : <Outlet />;
}

function DashboardPage() {
  const list = useServerFn(listMyTheses);
  const save = useServerFn(saveTrackedThesis);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const attemptedSave = useRef(false);
  const [retrySave, setRetrySave] = useState(0);
  const { user } = Route.useRouteContext();
  const query = useQuery({ queryKey: ["my-theses", user.id], queryFn: () => list(), retry: false });
  useEffect(() => {
    const marker = window.localStorage.getItem("victy_pending_save");
    if (attemptedSave.current || !marker) return;
    const pendingUser = window.localStorage.getItem("victy_pending_user");
    if (pendingUser && pendingUser !== user.id) {
      setSaveError(
        "This pending thesis belongs to another sign-in. Sign in with that account or start a new demo.",
      );
      return;
    }
    const name = window.localStorage.getItem("victy_pending_name") ?? "";
    const raw = window.localStorage.getItem(DEMO_KEY);
    if (!raw) {
      setSaveError("The pending demo is missing in this browser. Return to the demo to save it.");
      return;
    }
    let pending: (DemoSessionCredentials & { state?: DemoState }) | null = null;
    try {
      pending = JSON.parse(raw) as DemoSessionCredentials & { state?: DemoState };
    } catch {
      setSaveError("The pending demo could not be read. Return to the demo before saving.");
      return;
    }
    if (
      !pending?.state?.interpretation ||
      !pending.state.assets?.length ||
      (marker !== "1" && marker !== pending.id)
    ) {
      setSaveError(
        "The pending demo is incomplete or has changed. Return to the demo before saving.",
      );
      return;
    }
    window.localStorage.setItem("victy_pending_user", user.id);
    attemptedSave.current = true;
    setSaving(true);
    setSaveError("");
    void save({
      data: {
        credentials: { id: pending.id, secret: pending.secret },
        name,
        belief: pending.state.belief,
        interpretation: pending.state.interpretation,
        assets: pending.state.assets,
      },
    })
      .then(async ({ thesisId }) => {
        window.localStorage.removeItem("victy_pending_name");
        if (window.localStorage.getItem("victy_pending_save") === marker) {
          window.localStorage.removeItem("victy_pending_save");
          window.localStorage.removeItem("victy_pending_user");
        }
        void queryClient.invalidateQueries({ queryKey: ["my-theses"] });
        await navigate({ to: "/dashboard/thesis/$id", params: { id: thesisId }, replace: true });
      })
      .catch((error: unknown) =>
        setSaveError(
          error instanceof Error
            ? error.message
            : "Your thesis could not be saved. Please try again.",
        ),
      )
      .finally(() => setSaving(false));
  }, [navigate, queryClient, save, user.id, retrySave]);
  return (
    <main className="dashboard-page">
      <DashboardHeader />
      <section className="dashboard-shell">
        <div className="dashboard-title">
          <div>
            <p className="eyebrow">
              <span className="signal-dot" /> YOUR VICTY
            </p>
            <h1>My theses</h1>
            <p>Your ideas, translated into positions.</p>
          </div>
          <Button asChild>
            <Link to="/demo" search={{ fresh: true }}>
              <Plus /> New thesis
            </Link>
          </Button>
        </div>
        {saving && <div className="dashboard-loading">Saving your thesis…</div>}
        {saveError && (
          <div className="demo-error" role="alert">
            <p>{saveError}</p>
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => {
                attemptedSave.current = false;
                setSaveError("");
                setRetrySave((value) => value + 1);
              }}
            >
              Retry saving
            </Button>
          </div>
        )}
        {query.isLoading ? (
          <div className="dashboard-loading">Loading your theses…</div>
        ) : query.isError ? (
          <div className="demo-error" role="alert">
            <p>Your theses could not be loaded. Please try again.</p>
            <Button
              variant="outline"
              onClick={() => void query.refetch()}
              disabled={query.isFetching}
            >
              Try again
            </Button>
          </div>
        ) : query.data?.length ? (
          <div className="thesis-grid">
            {query.data.map((thesis) => (
              <article className="thesis-card" key={thesis.id}>
                <div className="thesis-card-head">
                  <span className="status-pill">
                    <span /> DEMO PERFORMANCE
                  </span>
                  <time>
                    {new Date(thesis.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </time>
                </div>
                <h2>{thesis.title}</h2>
                <p>{thesis.interpretation}</p>
                <div className="thesis-values">
                  <div>
                    <span>SIMULATED ALLOCATION</span>
                    <strong>{money.format(thesis.initialAmount)}</strong>
                  </div>
                  <div>
                    <span>CURRENT SIMULATED VALUE</span>
                    <strong>{money.format(thesis.currentValue)}</strong>
                  </div>
                  <div>
                    <span>SINCE CREATED</span>
                    <strong
                      className={thesis.performancePercent >= 0 ? "is-positive" : "is-negative"}
                    >
                      {thesis.performancePercent >= 0 ? "+" : ""}
                      {thesis.performancePercent.toFixed(1)}%
                    </strong>
                  </div>
                </div>
                <div className="thesis-assets">
                  {thesis.assets.map((asset) => (
                    <span key={asset.id}>
                      {asset.ticker} <b>{asset.allocation}%</b>
                    </span>
                  ))}
                </div>
                <Button asChild variant="outline">
                  <Link to="/dashboard/thesis/$id" params={{ id: thesis.id }}>
                    View thesis <ArrowRight />
                  </Link>
                </Button>
              </article>
            ))}
          </div>
        ) : (
          !saving && (
            <div className="dashboard-empty">
              <p className="eyebrow">NO SAVED THESES</p>
              <h2>Start with what you believe.</h2>
              <p>Explore an idea, build a composition and simulate your first position.</p>
              <Button asChild>
                <Link to="/demo" search={{ fresh: true }}>
                  Create a thesis <ArrowRight />
                </Link>
              </Button>
            </div>
          )
        )}
      </section>
    </main>
  );
}
