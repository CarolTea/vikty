import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, Mail } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VicTyLogo } from "@/components/victy-logo";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => ({
    next: search["next"] === "save" ? ("save" as const) : ("dashboard" as const),
  }),
  head: () => ({
    meta: [
      { title: "Access your VicTy — VicTy" },
      {
        name: "description",
        content: "Access your private VicTy dashboard with a secure email link.",
      },
      { property: "og:title", content: "Access your VicTy" },
      { property: "og:description", content: "Return to your saved investment theses." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { next } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (next === "save") setName(window.localStorage.getItem("victy_pending_name") ?? "");
  }, [next]);
  useEffect(() => {
    const finish = () =>
      void supabase.auth.getUser().then(({ data }) => {
        if (data.user) {
          if (
            window.localStorage.getItem("victy_pending_save") &&
            !window.localStorage.getItem("victy_pending_user")
          )
            window.localStorage.setItem("victy_pending_user", data.user.id);
          void navigate({ to: "/dashboard", replace: true });
        }
      });
    finish();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") setTimeout(finish, 0);
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (next === "save" && name.trim().length < 2) {
      setError("Enter your name.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    setLoading(true);
    if (next === "save") {
      window.localStorage.setItem("victy_pending_name", name.trim());
      if (!window.localStorage.getItem("victy_pending_save"))
        window.localStorage.setItem("victy_pending_save", "1");
    }
    const redirectTo = `${window.location.origin}/auth?next=${next}`;
    const options =
      next === "save"
        ? { emailRedirectTo: redirectTo, shouldCreateUser: true, data: { name: name.trim() } }
        : { emailRedirectTo: redirectTo, shouldCreateUser: true };
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options,
    });
    setLoading(false);
    if (authError) {
      setError("We couldn’t send the access link. Please try again.");
      return;
    }
    setSent(true);
  };
  return (
    <main className="auth-page">
      <header className="auth-header">
        <Link to="/">
          <VicTyLogo />
        </Link>
        <Button asChild variant="ghost" size="sm">
          <Link to="/">
            <ArrowLeft /> Back home
          </Link>
        </Button>
      </header>
      <section className="auth-shell">
        <div className="auth-copy">
          <p className="eyebrow">
            <span className="signal-dot" /> PRIVATE ACCESS
          </p>
          <h1>{next === "save" ? "Save your thesis" : "Access your VicTy"}</h1>
          <p>
            {next === "save"
              ? "Keep this composition and see how it evolves over time."
              : "Your ideas, translated into positions."}
          </p>
        </div>
        <div className="auth-card">
          {sent ? (
            <div className="auth-sent" role="status">
              <span>
                <Check />
              </span>
              <h2>Check your email</h2>
              <p>
                Open the secure link we sent to <strong>{email}</strong>. It will bring you back to
                VicTy.
              </p>
              <Button variant="outline" onClick={() => setSent(false)}>
                Use another email
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate>
              {next === "save" && (
                <label>
                  <span>Name</span>
                  <Input
                    autoComplete="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Your name"
                    maxLength={100}
                  />
                </label>
              )}
              <label>
                <span>Email</span>
                <Input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  maxLength={254}
                />
              </label>
              {error && (
                <p className="auth-error" role="alert">
                  {error}
                </p>
              )}
              <Button type="submit" size="lg" disabled={loading}>
                {loading ? "Sending…" : next === "save" ? "Save my thesis" : "Continue with email"}
                <ArrowRight />
              </Button>
              <p className="auth-note">
                <Mail /> We’ll email you a secure access link. No password needed.
              </p>
              {next === "save" && (
                <p className="auth-note">
                  We’ll use your email to give you access to your VicTy dashboard.
                </p>
              )}
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
