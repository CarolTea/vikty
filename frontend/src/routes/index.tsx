import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDown, ArrowRight, Check, ChevronRight, Menu, Minus, RotateCcw, X } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/reveal";
import { VicTyLogo } from "@/components/victy-logo";
import { cn } from "@/lib/utils";
import { joinEarlyAccess } from "@/lib/early-access.functions";
import { supabase } from "@/integrations/supabase/client";
import victyFrontAsset from "@/assets/victy-front-transparent.png.asset.json";
import { StrategyCard } from "@/components/strategies/strategy-card";
const StrategyPreviewDialog = lazy(() =>
  import("@/components/strategies/strategy-preview-dialog").then((module) => ({
    default: module.StrategyPreviewDialog,
  })),
);
import { demoStrategies } from "@/lib/strategies/mock-strategies";
import type { PublicStrategy } from "@/lib/strategies/types";
import victySunglassesAsset from "@/assets/victy-sunglasses-transparent.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VicTy — Invest in what you believe" },
      { name: "description", content: "Turn what you believe about the future into an investment thesis you can understand and control." },
      { property: "og:title", content: "VicTy — Invest in what you believe" },
      { property: "og:description", content: "Turn what you believe about the future into an investment thesis you can understand and control." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

function ArrowLink({ children, onClick, variant = "primary" }: { children: React.ReactNode; onClick: () => void; variant?: "primary" | "secondary" }) {
  return (
    <Button type="button" variant={variant} size="lg" onClick={onClick}>
      {children}<ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
    </Button>
  );
}

function Navigation() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => { void supabase.auth.getUser().then(({ data }) => setSignedIn(Boolean(data.user))); const { data } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(Boolean(session?.user))); return () => data.subscription.unsubscribe(); }, []);
  const navigate = (id: string) => { setOpen(false); scrollTo(id); };
  return (
    <header className={cn("site-nav", scrolled && "is-scrolled")}>
      <a href="#top" className="focus-ring rounded-md" aria-label="VicTy home"><VicTyLogo /></a>
      <nav className="hidden items-center gap-7 md:flex" aria-label="Main navigation">
        <button className="nav-link" onClick={() => navigate("how-it-works")}>How it works</button>
        <button className="nav-link" onClick={() => navigate("strategies")}>Strategies</button>
        <button className="nav-link" onClick={() => navigate("why-victy")}>Why VicTy</button>
        <button className="nav-link" onClick={() => navigate("about")}>About</button>
        <Link to="/demo" className="nav-link">Try the demo</Link>
        {signedIn ? <Link to="/dashboard" className="nav-link">My theses</Link> : <Link to="/auth" search={{ next: "dashboard" }} className="nav-link">Access</Link>}
        <Button size="sm" onClick={() => navigate("waitlist")}>Join the waitlist <ArrowRight className="size-3.5" /></Button>
      </nav>
      <Button variant="icon" size="icon" className="md:hidden" onClick={() => setOpen((value) => !value)} aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open}>
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </Button>
      {open && (
        <nav className="mobile-menu" aria-label="Mobile navigation">
          {([["How it works", "how-it-works"], ["Strategies", "strategies"], ["Why VicTy", "why-victy"], ["About", "about"]] as const).map(([label, id]) => (
            <button key={id} onClick={() => navigate(id)}>{label}<ChevronRight className="size-4" /></button>
          ))}
          <Button asChild variant="ghost"><Link to="/demo">Try the demo <ArrowRight className="size-4" /></Link></Button>
          <Button asChild variant="ghost">{signedIn ? <Link to="/dashboard">My theses <ArrowRight className="size-4" /></Link> : <Link to="/auth" search={{ next: "dashboard" }}>Access <ArrowRight className="size-4" /></Link>}</Button>
          <Button onClick={() => navigate("waitlist")}>Join the waitlist <ArrowRight className="size-4" /></Button>
        </nav>
      )}
    </header>
  );
}

function BeliefField() {
  return (
    <div className="belief-field" aria-label="A belief branching into economic exposures">
      <div className="aurora aurora-one" /><div className="aurora aurora-two" />
      <svg viewBox="0 0 680 520" className="absolute inset-0 size-full" aria-hidden="true">
        <path className="thesis-path path-a" d="M315 259 C380 254 399 146 510 137" />
        <path className="thesis-path path-b" d="M320 262 C401 283 432 260 563 264" />
        <path className="thesis-path path-c" d="M315 272 C383 306 418 389 522 402" />
        <circle className="path-node node-a" cx="510" cy="137" r="5" />
        <circle className="path-node node-b" cx="563" cy="264" r="5" />
        <circle className="path-node node-c" cx="522" cy="402" r="5" />
      </svg>
      <div className="belief-sentence"><span className="mono-label">A THESIS BEGINS</span><p>“AI will reshape data center infrastructure over the next 5 years.”</p></div>
      <span className="field-label label-one">Semiconductors</span>
      <span className="field-label label-two">Data centers</span>
      <span className="field-label label-three">Energy</span>
    </div>
  );
}

function Hero() {
  return (
    <section id="top" className="hero-section section-shell">
      <Navigation />
      <div className="hero-grid page-width">
        <div className="relative z-10 pt-24 lg:pt-0">
          <div className="eyebrow"><span className="signal-dot" /> BUILT ON SOLANA</div>
          <h1 className="hero-title">Invest in what<br /><span>you believe.</span></h1>
          <p className="hero-subtitle">Invest in a thesis, not a ticker.</p>
          <p className="hero-copy">Turn any belief about the future into an explainable, investable onchain strategy.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/demo">
                Build your thesis
                <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
              </Link>
            </Button>
            <Button type="button" variant="secondary" size="lg" onClick={() => scrollTo("strategies")}>
              Explore strategies
            </Button>
          </div>
          <p className="mt-5 flex items-center gap-2 text-sm text-muted-foreground"><span className="size-1.5 rounded-full bg-signal" /> Non-custodial · You stay in control</p>
        </div>
        <BeliefField />
      </div>
      <button className="scroll-cue" onClick={() => scrollTo("belief")} aria-label="Scroll to the story"><span>THE THESIS UNFOLDS</span><ArrowDown className="size-4" /></button>
    </section>
  );
}

function BeliefToStructure() {
  return (
    <section id="belief" className="story-section section-shell overflow-hidden">
      <div className="page-width">
        <Reveal className="max-w-3xl"><p className="eyebrow">BELIEF → INTELLIGENCE</p><h2 className="section-title">A belief is where it starts.</h2><p className="section-copy">Markets give you tickers. VicTy starts with the idea behind them.</p></Reveal>
        <Reveal className="transformation" delay={120}>
          <div className="belief-origin"><span className="mono-label">YOUR BELIEF</span><p>I believe AI infrastructure will keep expanding.</p></div>
          <svg className="transform-paths" viewBox="0 0 1120 430" preserveAspectRatio="none" aria-hidden="true">
            <path d="M210 215 C355 215 360 74 544 74 S760 66 905 66" />
            <path d="M210 215 C364 215 383 214 544 214 S760 212 905 212" />
            <path d="M210 215 C350 218 372 352 544 352 S760 355 905 355" />
          </svg>
          <div className="exposure-list">
            {["Semiconductors", "Data centers", "Energy infrastructure"].map((item, index) => <div key={item} className="exposure-item" style={{ "--item-delay": `${index * 180}ms` } as React.CSSProperties}><span>0{index + 1}</span>{item}</div>)}
          </div>
          <div className="instrument-list"><span className="mono-label">POSSIBLE INSTRUMENTS · ILLUSTRATIVE</span><span><strong>NVDA</strong> NVIDIA</span><span><strong>EQIX</strong> Equinix</span><span><strong>NEE</strong> NextEra Energy</span></div>
        </Reveal>
      </div>
    </section>
  );
}

const exposures = [
  { name: "Semiconductors", value: 40, color: "var(--primary)", text: "The compute layer behind accelerated infrastructure.", why: "Core demand exposure", risks: "Cycles · concentration" },
  { name: "Data centers", value: 35, color: "var(--violet)", text: "The physical capacity where AI workloads operate.", why: "Capacity expansion", risks: "Rates · utilization" },
  { name: "Energy", value: 25, color: "var(--signal)", text: "The power systems required to sustain compute growth.", why: "Power demand", risks: "Regulation · buildout" },
];

function Composition() {
  return (
    <section id="composition" className="composition-section section-shell">
      <div className="page-width composition-grid">
        <Reveal><p className="eyebrow">INTELLIGENCE → STRUCTURE</p><h2 className="section-title">See what your thesis<br />is made of.</h2><p className="section-copy">VicTy translates your conviction into economic exposures and shows how each one can be represented.</p></Reveal>
        <Reveal className="composition-visual" delay={120}>
          <div className="composition-head"><span className="mono-label">THESIS COMPOSITION</span><span className="status-pill"><span /> STRUCTURED</span></div>
          <div className="composition-bar">{exposures.map((item) => <div key={item.name} style={{ width: `${item.value}%`, background: item.color }} />)}</div>
          <div className="composition-rows">
            {exposures.map((item) => <div className="composition-row" key={item.name}><span className="color-key" style={{ background: item.color }} /><div><strong>{item.name}</strong><p>{item.text}</p></div><b>{item.value}%</b></div>)}
          </div>
          <div className="explain-grid">{["What it represents", "Why it's here", "Known risks"].map((label, i) => <div key={label}><span className="mono-label">{label}</span><p>{i === 0 ? "Economic exposure" : i === 1 ? "Thesis relevance" : "Visible, not hidden"}</p></div>)}</div>
        </Reveal>
      </div>
    </section>
  );
}

type Allocation = typeof exposures[number] & { active: boolean };

function ControlMoment() {
  const [items, setItems] = useState<Allocation[]>(exposures.map((item) => ({ ...item, active: true })));
  const total = useMemo(() => items.filter((item) => item.active).reduce((sum, item) => sum + item.value, 0), [items]);
  const changeValue = (name: string, delta: number) => setItems((current) => current.map((item) => item.name === name ? { ...item, value: Math.max(5, Math.min(70, item.value + delta)) } : item));
  const toggle = (name: string) => setItems((current) => current.map((item) => item.name === name ? { ...item, active: !item.active } : item));
  return (
    <section className="control-section section-shell">
      <div className="page-width control-grid">
        <Reveal><p className="eyebrow">STRUCTURE → DECISION</p><h2 className="section-title">Your thesis.<br /><span className="gradient-text">Your decisions.</span></h2><p className="section-copy">VicTy proposes the structure. You decide what belongs in it.</p>
          <div className="principles">{["Understand before you act.", "Edit what you disagree with.", "Invest one decision at a time."].map((p, i) => <p key={p}><span>0{i + 1}</span>{p}</p>)}</div>
        </Reveal>
        <Reveal className="control-panel" delay={100}>
          <div className="control-header"><div><span className="mono-label">EDIT COMPOSITION</span><p>AI Infrastructure Expansion</p></div><div className={cn("total", total !== 100 && "is-warning")}><span>TOTAL</span><b>{total}%</b></div></div>
          <div className="control-items">{items.map((item) => <div className={cn("control-item", !item.active && "is-removed")} key={item.name}>
            <span className="color-key" style={{ background: item.color }} /><div className="min-w-0 flex-1"><strong>{item.name}</strong><small>{item.why}</small></div>
            {item.active ? <div className="stepper"><Button variant="icon" size="icon" aria-label={`Decrease ${item.name}`} onClick={() => changeValue(item.name, -5)}><Minus /></Button><output>{item.value}%</output><Button variant="icon" size="icon" aria-label={`Increase ${item.name}`} onClick={() => changeValue(item.name, 5)}>+</Button></div> : <span className="removed-label">REMOVED</span>}
            <Button variant="icon" size="icon" aria-label={item.active ? `Remove ${item.name}` : `Restore ${item.name}`} onClick={() => toggle(item.name)}>{item.active ? <X /> : <RotateCcw />}</Button>
          </div>)}</div>
          <div className="risk-note"><span className="mono-label">WHY IT'S HERE</span><p>Each exposure includes its role, representation and known risks before you act.</p></div>
        </Reveal>
      </div>
      <Reveal className="decision-line"><span />Nothing happens without you.<span /></Reveal>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    ["Describe", "Tell VicTy what you believe about the future."],
    ["Understand", "VicTy identifies the economic exposures behind the thesis."],
    ["Review", "See the instruments, reasoning and known risks."],
    ["Decide", "Adjust the composition and choose what you want to act on."],
  ];
  return <section id="how-it-works" className="how-section section-shell"><div className="page-width"><Reveal><p className="eyebrow">HOW IT WORKS</p><h2 className="section-title">From conviction<br />to clarity.</h2></Reveal><div className="journey">{steps.map(([title, copy], index) => <Reveal className="journey-step" delay={index * 100} key={title}><span className="journey-number">0{index + 1}</span><span className="journey-node" /><h3>{title}</h3><p>{copy}</p></Reveal>)}</div></div></section>;
}

function WhyVicTy() {
  const ideas = [
    ["Ideas before assets", "Start with what you believe about the future."],
    ["Understanding before execution", "Know what an instrument represents and why it is there."],
    ["Control before automation", "You review and decide each step."],
  ];
  return <section id="why-victy" className="why-section section-shell"><div className="page-width"><Reveal><p className="eyebrow">WHY VICTY</p><h2 className="display-title">Investing shouldn’t<br />start with a ticker.</h2></Reveal><div className="idea-list">{ideas.map(([title, copy], index) => <Reveal className="idea-row" delay={index * 80} key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{copy}</p></Reveal>)}</div></div></section>;
}

function About() {
  return <section id="about" className="about-section section-shell"><div className="page-width about-grid"><Reveal><p className="eyebrow">BUILT DIFFERENTLY</p><h2 className="section-title">Built by women.<br /><span className="gradient-text">Built for independent decisions.</span></h2></Reveal><Reveal delay={100}><p className="about-copy">VicTy is built by an all-women team creating technology for clearer, more autonomous investment decisions.</p></Reveal><Reveal className="about-victy-wrap" delay={180}><img src={victySunglassesAsset.url} loading="lazy" decoding="async" alt="VicTy wearing sunglasses and celebrating with confidence" className="about-victy" /></Reveal></div></section>;
}

function Waitlist() {
  const submitSignup = useServerFn(joinEarlyAccess);
  const [fields, setFields] = useState({ name: "", whatsapp: "", email: "", website: "" });
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");
  const updateField = (field: keyof typeof fields, value: string) => {
    setFields((current) => ({ ...current, [field]: value }));
    if (error) setError("");
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const name = fields.name.trim();
    const email = fields.email.trim();
    const phoneDigits = fields.whatsapp.replace(/\D/g, "");
    if (name.length < 2 || name.length > 100) { setError("Enter your full name."); return; }
    if (phoneDigits.length < 8 || phoneDigits.length > 15 || phoneDigits.startsWith("0")) { setError("Enter your WhatsApp with country code."); return; }
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("Enter a valid email address."); return; }
    setError(""); setStatus("loading");
    try {
      const result = await submitSignup({ data: { ...fields, name, email, whatsapp: `+${phoneDigits}` } });
      if (result.ok) { setStatus("success"); return; }
      setStatus("idle");
      setError(result.reason === "duplicate" ? "This email or WhatsApp is already on the list." : result.reason === "invalid" ? "Check your details and try again." : "We couldn’t save your details. Please try again.");
    } catch {
      setStatus("idle");
      setError("We couldn’t save your details. Please try again.");
    }
  };
  return <section id="waitlist" className="waitlist-section section-shell"><div className="page-width"><Reveal className={cn("waitlist-panel", status === "success" && "is-success")}><div className="waitlist-aurora" />{status === "success" ? <div className="success-layout" role="status"><div className="success-state"><span className="success-icon"><Check /></span><p className="eyebrow">EARLY ACCESS</p><h2>You’re on the list.</h2><p>We’ll let you know when VicTy is ready for you.</p></div><div className="success-victy-wrap" aria-hidden="true"><img src={victyFrontAsset.url} loading="lazy" decoding="async" alt="" className="success-victy" /></div></div> : <div className="relative z-10 max-w-3xl"><p className="eyebrow">EARLY ACCESS</p><h2>What do you<br /><span className="gradient-text">believe in?</span></h2><p>We’re building a different way to turn conviction into investment decisions. Be among the first to experience VicTy.</p><form onSubmit={submit} noValidate><div className="signup-fields"><label><span>Full name</span><input type="text" autoComplete="name" maxLength={100} value={fields.name} onChange={(e) => updateField("name", e.target.value)} placeholder="Your name" aria-invalid={Boolean(error)} disabled={status === "loading"} /></label><label><span>WhatsApp</span><input type="tel" inputMode="tel" autoComplete="tel" maxLength={24} value={fields.whatsapp} onChange={(e) => updateField("whatsapp", e.target.value)} placeholder="+55 11 99999 9999" aria-invalid={Boolean(error)} disabled={status === "loading"} /></label><label><span>Email address</span><input type="email" autoComplete="email" maxLength={254} value={fields.email} onChange={(e) => updateField("email", e.target.value)} placeholder="you@example.com" aria-invalid={Boolean(error)} aria-describedby="signup-help" disabled={status === "loading"} /></label><label className="signup-trap" aria-hidden="true"><span>Website</span><input tabIndex={-1} autoComplete="off" value={fields.website} onChange={(e) => updateField("website", e.target.value)} /></label><Button type="submit" size="lg" disabled={status === "loading"}>{status === "loading" ? "Joining…" : "Join the waitlist"}<ArrowRight className="size-4" /></Button></div><p id="signup-help" className={cn("form-note", error && "text-destructive")} role={error ? "alert" : undefined}>{error || "Your details stay private. No spam — only meaningful VicTy updates."}</p></form></div>}</Reveal></div></section>;
}

function BeliefToStrategy() {
  const steps = ["What do you believe?", "VicTy maps the exposures", "Finds assets that represent them", "Builds an editable strategy", "You decide what to invest in"];
  return <section id="belief-to-strategy" className="flow-section section-shell"><div className="page-width"><Reveal><p className="eyebrow">FROM BELIEF TO STRATEGY</p><h2 className="section-title">One idea.<br /><span className="gradient-text">A strategy you control.</span></h2></Reveal><ol className="flow-steps">{steps.map((step, index) => <li key={step}><Reveal className="flow-step" delay={index * 90}><span>0{index + 1}</span><p>{step}</p></Reveal></li>)}</ol></div></section>;
}

function StrategyNetwork() {
  const cards = [
    ["Create", "Turn your thesis into a strategy."],
    ["Publish", "Make it discoverable."],
    ["Build a track record", "Performance becomes part of your history."],
    ["Earn", "Creators may earn a share of VicTy execution revenue when others invest through their strategies."],
  ];
  return <section id="strategy-network" className="network-section section-shell"><div className="page-width"><Reveal className="max-w-3xl"><p className="eyebrow">STRATEGY NETWORK</p><h2 className="section-title">Your thesis doesn’t have to stay private.</h2><p className="section-copy">Publish your strategy, build a track record and let others follow how your ideas perform.</p></Reveal><div className="network-grid">{cards.map(([title, copy], index) => <Reveal className="network-card" delay={index * 80} key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{copy}</p></Reveal>)}</div><p className="form-note mt-6">Coming soon. Earnings are not guaranteed and depend on future program terms.</p></div></section>;
}

function ExploreStrategies() {
  const [preview, setPreview] = useState<PublicStrategy | null>(null);
  return <section id="strategies" className="strategies-section section-shell"><div className="page-width"><Reveal><p className="eyebrow">EXPLORE STRATEGIES · EXAMPLES</p><h2 className="section-title">See how others<br /><span className="gradient-text">structure their beliefs.</span></h2><p className="section-copy">Example strategies from fictional creators. Performance and followers are simulated demo data.</p></Reveal><div className="strategy-grid mt-12">{demoStrategies.map((strategy) => <StrategyCard key={strategy.id} strategy={strategy} onOpen={setPreview} />)}</div></div>{preview && <Suspense fallback={<p role="status">Loading strategy…</p>}><StrategyPreviewDialog strategy={preview} onClose={() => setPreview(null)} /></Suspense>}</section>;
}

function BuiltAnywhere() {
  const surfaces = ["VicTy App", "AI Agents", "Wallets", "Fintechs", "Creator Platforms"];
  const stack = ["VicTy API", "Thesis Engine", "Strategies", "Execution"];
  return <section id="infrastructure" className="anywhere-section section-shell"><div className="page-width anywhere-grid"><Reveal><p className="eyebrow">INFRASTRUCTURE</p><h2 className="section-title">Built to work anywhere.</h2><p className="section-copy">VicTy is not just an app. The same thesis intelligence can power wallets, AI agents, fintechs and creator platforms.</p></Reveal><Reveal className="anywhere-diagram" delay={120}><div className="anywhere-surfaces">{surfaces.map((s) => <span key={s}>{s}</span>)}</div>{stack.map((layer) => <div key={layer} className="anywhere-layer"><ArrowDown className="size-4" /><strong>{layer}</strong></div>)}</Reveal></div></section>;
}

function Footer() {
  return <footer className="site-footer"><div className="page-width"><div className="footer-main"><div><VicTyLogo /><p>Invest in what you believe.</p></div><nav aria-label="Footer navigation">{["Product", "Privacy", "Terms", "X", "LinkedIn"].map((link) => <span key={link}>{link}</span>)}</nav></div><div className="footer-bottom"><p>Built by women. Built on Solana.</p><p>VicTy doesn’t provide financial advice.</p><p>© 2026 VicTy</p></div></div></footer>;
}

function Index() {
  return <main className="min-h-screen overflow-x-clip bg-background text-foreground"><Hero /><BeliefToStructure /><BeliefToStrategy /><Composition /><ControlMoment /><HowItWorks /><StrategyNetwork /><ExploreStrategies /><WhyVicTy /><BuiltAnywhere /><About /><Waitlist /><Footer /></main>;
}