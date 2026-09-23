# VicTy design system

Tokens and reference styles for the VicTy interface. Source of truth for colors, type, spacing, radii and component styling.

| File | What |
|---|---|
| `tokens.json` | All tokens (colors, type, spacing, radius, shadow, blur, opacity) with a usage note each. |
| `tokens.css` | The same tokens as CSS custom properties, plus one class per type style. Generated from `tokens.json`: do not edit by hand. |
| `components.css` | Reference component styles (`vt-*` classes) built on the tokens. |

Use the tokens by name (`var(--primary)`, `var(--radius-lg)`); never hard-code a color or size that has a token.

VicTy turns a belief about the future into an investment the user understands — *invest in a thesis, not a ticker*. The interface is a calm, precise instrument for crypto-literate people: dark, layered glass, one indigo voice, and numbers set like data. Everything the user sees is in **English**.

## Content fundamentals

- **Write for someone who already uses a wallet.** Use crypto terms without explaining them (wallet, USDC, mint, slippage, route). Explain what they can't know: what an instrument represents, who issues it, what it doesn't cover.
- **Precise and calm.** Short sentences, sentence case, "you" for the user, "we" for VicTy. No exclamation marks, no emoji.
- **Never promise returns.** No "earn", "grow", "yield", price targets or urgency. The copy describes exposure, never outcomes.
- **Limitations are answers, not errors.** Say them plainly and offer a way forward: "We couldn't find enough representation in the catalog for this thesis. We'd rather not substitute something similar."
- **Every disabled action says why**, right under it: "Fix weights to invest", "No buy route right now", "Write your thesis to continue".
- **Name the user's decision, not the system.** "Invest", "Reject", "Undo", "Connect wallet", "See composition" — verbs, one action each. There is no "Buy all" and no "Rebalance".
- **Numbers carry their unit**: `35% · 175 USDC`, `500 USDC`. USDC is written as a unit after the number.

Real copy from the product:

| Where | Copy |
|---|---|
| Discovery | "What do you believe in?" · "Describe a belief. We show how it can be represented, with instruments you understand." |
| Interpreting | "Interpreting your thesis…" · steps "Reading the thesis", "Identifying exposures", "Checking the catalog" |
| Composition | "How this thesis can be represented" · "Not your balance — it's how much you plan to allocate. Nothing is bought yet." |
| Rejection | "Rejecting an asset doesn't redistribute its weight. Adjust the remaining weights or ask for a new proposal." |
| Footer | "VicTy doesn't provide financial advice." |

## Visual foundations

**Ground and light.** Every screen sits on `bg`. Two or three aurora beams (`aurora-indigo`, `aurora-violet`, at most one `aurora-teal`) are blurred by `blur-aurora` at `opacity-aurora` behind the main area — light, never content. A 3–4% grain sits on top.

**Glass, in three layers.** Depth comes from layering, not shadows:
1. `bg` with the auroras;
2. panels in `glass` — the header, empty and loading panels — with `glass-border`, the `glass-highlight` top edge, `shadow-glass` and a backdrop blur of `blur-glass`;
3. cards and inputs in `glass-strong`, the surface for anything with a lot of text.

Glass never costs readability: small text never sits directly on an aurora — put it on `glass-strong`.

**One voice of color.** `primary` is the only brand color: links, the active step, the focus ring. The primary button is filled with `primary-fill`, with `on-primary` text and `shadow-primary-glow`. One primary button per view area (the header's "Connect wallet" doesn't count). Semantic color is separate from the brand: `accent` = valid / available / done, `warning` = limitation, `danger` = invalid / blocked. Each is used as text on its `-soft` tint and **always with an icon and words**, never color alone.

**Type.** Manrope for display and UI, JetBrains Mono for numbers. `display` appears once (the Discovery question). Pages open with `title-1` and a `body-lg` subtitle in `text-muted`. Cards use `heading` and `body`; notes and reasons use `body-sm` (never below 13px); eyebrows use `label` in uppercase. Every weight, amount, percentage and mint is set in `figure` or `figure-lg` with tabular figures.

**Spacing and radius.** Cards pad `space-6`, panels `space-8`; grids gap `space-4`. Radii go by role: `radius-md` for buttons, inputs and notices, `radius-lg` for cards, `radius-xl` for panels, `radius-pill` for chips, status pills and the composition bar.

**States.** Hover lifts a glass border toward `text-faint`; focus is `focus-ring` on every control (a 2px `bg` gap, then a 2px `primary` ring). Disabled means `glass` with `text-faint` label **plus** a `body-sm` reason. A rejected asset card drops to `opacity-rejected`, and its Undo control stays at full strength.

**Motion.** Quiet. The progress step pulses its halo, and cards fade in once. Everything stops under `prefers-reduced-motion`.

**Layout.** Content is at most 1200px wide and centered, under a glass header bar (wordmark + tagline · network · Connect wallet). The Composition step uses two columns: asset cards in a 2×2 grid on the left, and a sticky summary panel on the right (budget, composition bar, status, notices).

**Density — known issue.** The first Composition mockup was too dense. Keep the asset card lean: ticker and name, the exposure, "Why it's here", the risks, availability, and the weight row with its actions. Issuer, nature and evidence belong in the Instrument details panel, not on the card.

## Iconography

Line icons in the Lucide style: 24px grid, 1.75 stroke, round caps and joins, drawn in `currentColor` and set at 18–20px. They live in icon tiles (`radius-lg`, `glass-strong`, a 1px `glass-border`) on cards and panels. The icons in this system's `Icon` component are drawn to match that style; in the app, use the Lucide package.

- No emoji.
- The Solana network is written as text — the Solana mark is not reproduced here.
- **Logo: missing.** The mockups show a gradient "V" mark, but no source file exists, so this system sets the name as a wordmark ("VicTy" in `heading` weight 800). Add the real mark as an asset when it exists; never redraw it.

## Accessibility

Text meets 4.5:1 on its grounds: `text` and `text-muted` on `bg`, `glass` and `glass-strong`; `primary`, `accent`, `warning` and `danger` on `bg`, glass and their `-soft` tints; `on-primary` on `primary-fill`. `text-faint` (≈4.2:1) is only for placeholders and disabled labels. Focus is always visible. Status is never color-only. The composition bar always has a labelled legend.
