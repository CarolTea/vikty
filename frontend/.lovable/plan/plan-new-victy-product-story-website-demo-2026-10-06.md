# Plan: New VicTy product story (website + demo)

Frontend-only update. No changes to the thesis engine, wallet, sign-in, saved data, AI integration, execution, or database.

## Landing page
1. Hero keeps "Invest in what you believe." / "Invest in a thesis, not a ticker." Support copy: "Turn any belief about the future into an explainable, investable onchain strategy." CTAs: "Build your thesis" (to /demo) and "Explore strategies" (scrolls to the strategies section).
2. New "FROM BELIEF TO STRATEGY" section: What do you believe? -> VicTy maps the exposures -> Finds assets that represent them -> Builds an editable strategy -> You decide what to invest in.
3. New Strategy Network section: "Your thesis doesn't have to stay private." with 4 cards: Create, Publish, Build a track record, Earn ("Creators may earn a share of VicTy execution revenue when others invest through their strategies." with no percentage or guarantee).
4. New "Explore strategies" section with example cards @maya "The Robotics Decade" and @lucas "Brazil Rate Cycle", labeled Demo, with simulated performance and demo follower counts.
5. New "Built to work anywhere." section near the bottom: VicTy App / AI Agents / Wallets / Fintechs / Creator Platforms -> VicTy API -> Thesis Engine -> Strategies -> Execution.
6. Navigation adds "Strategies"; current visual identity preserved.

## Demo
7. "Or start with an example" gains a "Or explore a public strategy" area listing the example strategies plus any strategy published this session.
8. Clicking a strategy opens a preview: creator, title, thesis, exposures, composition, rationale, risks, simulated performance, "Use as inspiration" (prefills the thesis) and "Build your own thesis"; Follow/Fork shown as "Coming soon".
9. After a strategy is saved: "Keep private" / "Publish strategy". Publish opens a form (strategy name, short description, creator name, Visibility: Public) and then "Your strategy is live." with "View public strategy" and "Share" (copy text). Published items live only in memory for the open session.

## Terminology
Prefer "strategy" wording for structured objects ("Save strategy", "Publish strategy"); avoid "portfolio" as a primary name.

## Technical details
- `src/lib/strategies/types.ts` + `mock-strategies.ts` (id, creatorHandle, creatorName, title, thesisSummary, themes, visibility, simulatedPerformance, followers, isDemo, plus preview fields).
- In-memory session store (React context) for published strategies; cleared on refresh/sign-out.
- Components: `StrategyCard`, `StrategyPreviewDialog`, `PublishStrategyDialog` in `src/components/strategies/`.
- Edits: `src/routes/index.tsx`, `src/routes/demo.tsx`, `composition-workspace.tsx` (publish state after tracking), styles in `src/styles.css` using existing tokens.
- No migrations, server functions, or provider changes. Validate with Playwright on desktop and mobile.
