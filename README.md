# VicTy

> **Invest in what you believe.**
>
> Turn ideas into strategies. Understand your choices. Invest on your terms.

People have beliefs about the future, but turning a conviction into an investment decision requires
knowledge of assets, risks and markets. **VicTy bridges that gap:** it starts with an idea, identifies
the economic exposures behind it, and proposes a portfolio of Solana assets people can understand and
adjust before they invest. Each asset comes with why it is there, what it actually represents and
what role it plays in the thesis. Buying and selling happen one asset at a time, always authorized by
the user's own wallet.

Our vision also makes these strategies shareable: discover ideas from other creators, understand
their rationale, adapt them, and decide how to participate — through the VicTy app or, eventually,
within partner wallets, apps and AI agents through the VicTy API.

**Built by women. Built for independent decisions.**

[Explore VicTy](https://victy.finance) · [Try the demo](https://victy.finance/demo) · [API contract](Docs/api/openapi.yaml) · [Roadmap](#roadmap)

🚧 **Under construction** — MVP built for a hackathon.

## From belief to portfolio

> "I believe artificial intelligence will increase demand for energy."

VicTy helps explore what that idea means economically, which approved instruments can represent it,
and where that representation falls short.

1. **Conviction** — describe what you believe in, or pick a suggested thesis.
2. **Interpretation** — VicTy translates the idea into economic exposures, exclusions and open
   questions, and shows how it understood it.
3. **Composition** — a proposal built only from approved instruments, with the role, weight and risks
   of each one. You can reject assets and adjust weights; every edit is validated, never silently
   redistributed.
4. **One operation at a time** — each buy or sell is reviewed (price, fees, slippage, expiry) and
   signed in your wallet.
5. **Tracking** — the real position per thesis: plan versus executed, based on what actually happened
   on-chain.

## Three pillars

| Pillar | Purpose | Status |
| --- | --- | --- |
| **Thesis Engine** | Translate beliefs into understandable portfolios, with rationale and limitations. | In the demo app, and as the VicTy API (interpretation and composition). |
| **SocialFi** | Discover, share and adapt strategies from creators and communities. | Demonstration interface and in-session publishing. A persistent network and creator compensation are on the roadmap. |
| **API-first** | Bring VicTy intelligence to wallets, apps, fintechs and agents. | A versioned [OpenAPI contract](Docs/api/openapi.yaml) and its first routes in [`backend/`](backend/). Partner access is on the roadmap. |

## Principles

- **Understand before investing.** Explain the relationship between a thesis, an instrument and its
  risks in plain language.
- **Non-custodial.** VicTy never has access to keys or funds. Every transaction is signed in the
  investor's own wallet.
- **You decide every operation.** No automatic execution of the composition, no rebalancing, DCA or
  scheduled orders. AI-proposed changes require explicit review.
- **Approved instruments only.** The AI interprets the conviction but doesn't pick tokens freely: it
  chooses among a curated registry of verified instruments, and the server validates every answer.
- **Visible limitations.** A thesis without enough representation gets an explanation, never a
  portfolio filled with unrelated assets.
- **Honest numbers.** No data, no number. Simulations are labeled as such, and missing prices or
  availability are shown instead of estimated.
- **No promise of returns.**

VicTy is not a swap interface or a token list — the unit is the conviction, not the asset — and it is
not an automated robo-advisor.

## Repository layout

This repository holds two applications:

```text
.
├── frontend/           # The web app (landing, demo, dashboard), built and published with Lovable
├── backend/            # The VicTy API: interpretation, composition, validation, sessions and quotas
├── Docs/
│   ├── api/            # OpenAPI contract between frontend and backend (published to GitHub Pages)
│   └── design-system/  # Tokens and reference components
├── docker-compose.yml  # Local backend + PostgreSQL + Redis
└── render.yaml         # Deploys the API and Redis on Render
```

### Two server sides, for now

The frontend was born as a self-contained Lovable app, so it still has **its own server functions**
(`frontend/src/lib/*.functions.ts`, `frontend/src/lib/ai/`, Supabase): they power today's demo,
early-access list, email login and simulated dashboard.

**`backend/` is where VicTy's logic lives from now on.** It implements the [API
contract](Docs/api/openapi.yaml): wallet sign-in through Privy, real Solana execution through Jupiter,
and the rules in the PRD. The frontend moves to it screen by screen; as each screen does, the
matching demo server function goes away.

| In the demo app (`frontend/`) | In the VicTy API (`backend/`) |
| --- | --- |
| Thesis clarification and interpretation | `POST /interpretations` (scope gate, input and output checks, quotas) |
| Portfolio proposal | `POST /proposals`, `POST /proposals/{id}/validations` |
| Curated demo catalog with fixed prices | Asset Registry: only instruments with a confirmed mint are approved |
| Anonymous demo sessions | Signed anonymous session cookie |
| Wallet message approval | Privy Sign-In With Solana |
| Email login and saved theses | Plans tied to the wallet (next) |
| Simulated performance | Real position from on-chain data (next) |

### `frontend/` comes from another repository

`frontend/` is imported, with its full history, from
[CarolTea/victylp](https://github.com/CarolTea/victylp), the repository Lovable edits and publishes.
**Change the frontend there (or in Lovable), never directly here**, then bring the changes in:

```bash
git pull -X subtree=frontend https://github.com/CarolTea/victylp.git main
```

A direct edit in `frontend/` would conflict with the next pull.

## Stack and integrations

| Layer | Technology |
| --- | --- |
| Blockchain | Solana |
| Execution | Jupiter Swap API v2 (`/order` + `/execute`) |
| Prices and metadata | Jupiter Price API v3 · Jupiter Tokens API v2 |
| Wallet and sign-in | Standard Solana wallets · Privy (Sign-In With Solana) |
| Frontend | React 19, TypeScript, TanStack Start, Tailwind CSS 4, Radix UI · built with Lovable, at `victy.finance` |
| Backend | Node.js 22, TypeScript, Fastify · on Render, at `api.victy.finance` |
| AI | OpenAI with structured outputs, validated with Zod and deterministic checks |
| Data | PostgreSQL on Neon · Redis (Render Key Value) for quotas · Supabase for the demo app |
| Bot protection | Cloudflare Turnstile |
| Tests | `node:test` with PGlite (backend) · Bun (frontend) |

## Running locally

### Backend

Prerequisites: [Docker](https://www.docker.com/).

```bash
cp backend/.env.example backend/.env    # fill in AI_API_KEY, PRIVY_*, SOLANA_RPC_URL, etc.
docker compose up --build               # API on port 3001, plus PostgreSQL and Redis
```

Without Docker: `cd backend && npm ci && npm run dev` (needs Postgres and Redis running). Tests:
`npm test` — they use fakes and an in-memory Postgres, no services needed.

### Frontend

Prerequisites: [Bun](https://bun.sh/) and access to the Supabase / Lovable Cloud project. See
[`frontend/README.md`](frontend/README.md) for its environment variables.

```bash
cd frontend
bun install --frozen-lockfile
bun run dev
```

Checks: `bun test tests/`, `bunx tsc --noEmit`, `bun run build`.

## Deploy

The API and Redis run on Render ([`render.yaml`](render.yaml)), Postgres on Neon, and the frontend is
published by Lovable at `victy.finance`, calling the API at `api.victy.finance`.

## Roadmap

Phases describe priorities, not committed dates.

### 1. Demonstration experience — foundation implemented

- [x] Visual identity, landing page and early-access registration.
- [x] Interactive belief, clarification and portfolio journey.
- [x] Thesis Engine with AI, curated catalog and response validation.
- [x] Wallet connection, email login, private theses and an illustrative dashboard.
- [x] Demonstration interface for strategy discovery and in-session publishing.

### 2. VicTy API and real execution

- [x] API contract for the MVP journey ([OpenAPI](Docs/api/openapi.yaml)).
- [x] Anonymous sessions, wallet sign-in and AI quotas.
- [x] Interpretation with scope gate and input/output checks.
- [x] Asset Registry and deterministic composition validator.
- [x] Composition proposals and draft validation.
- [ ] Suggested theses, interpretation corrections and instrument details.
- [ ] Plans tied to the wallet.
- [ ] Verify mints, availability, eligibility and liquidity of executable instruments.
- [ ] Jupiter quotes and individual, wallet-signed buys and sells, without duplicate operations.
- [ ] Position and activity reconciled with on-chain data.
- [ ] Move every frontend screen to the API.

### 3. SocialFi — strategies as shareable content

- [ ] Persist public strategies, authorship and versions.
- [ ] Discovery, following and adaptation of other creators' strategies.
- [ ] Separate simulation history from verified execution results.
- [ ] Transparent criteria for discovery and rankings.
- [ ] Execution attribution and creator compensation.

### 4. API-first — partner distribution

- [ ] Partner authentication, quotas, observability and documentation.
- [ ] Integration examples for wallets, applications and agents.
- [ ] Validate the commercial model with partner pilots.

## Business model under validation

1. **Execution:** a transparent fee on volume actually executed through VicTy integrations.
2. **Strategies:** a creator share of revenue from executions attributed to their strategies.
3. **API:** usage fees, licensing or revenue sharing for partner integrations.

Pricing, revenue sharing and economic viability are still being validated; nothing here implements
billing yet. The proposed metric, **Thesis Volume**, is the financial volume actually executed from
theses; simulated amounts don't count.

## Documentation

- [API contract (OpenAPI)](Docs/api/openapi.yaml)
- [Design system](Docs/design-system/README.md)
- [Thesis Engine and demo catalog](frontend/docs/thesis-engine.md)
- [Demo wallet approval](frontend/docs/solana-demo-wallet.md)
- [Demo persistence and manual tests](frontend/docs/thesis-persistence-validation.md)

## Disclaimer

VicTy is under development. Portfolio proposals and simulations do not promise returns, and nothing
here is investment advice. Instruments have their own risks and access conditions, which must be
assessed before real execution.
