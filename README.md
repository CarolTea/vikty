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

[Explore VicTy](https://victy.finance) · [API contract](Docs/api/openapi.yaml) · [Roadmap](#roadmap)

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
| **Thesis Engine** | Translate beliefs into understandable portfolios, with rationale and limitations. | In the VicTy API (interpretation and composition). |
| **SocialFi** | Discover, share and adapt strategies from creators and communities. | On the roadmap. |
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
├── frontend/           # The web app, built on the API contract and the design system (in progress)
├── backend/            # The VicTy API: interpretation, composition, validation, sessions and quotas
├── Docs/
│   ├── api/            # OpenAPI contract between frontend and backend (published to GitHub Pages)
│   └── design-system/  # Tokens and reference components
├── docker-compose.yml  # Local backend + PostgreSQL + Redis
└── render.yaml         # Deploys the API and Redis on Render
```

**`backend/` is where VicTy's logic lives.** It implements the [API contract](Docs/api/openapi.yaml):
wallet sign-in through Privy, real Solana execution through Jupiter, and the rules in the PRD. The
frontend talks to VicTy only through that contract.

## Stack and integrations

| Layer | Technology |
| --- | --- |
| Blockchain | Solana |
| Execution | Jupiter Swap API v2 (`/order` + `/execute`) |
| Prices and metadata | Jupiter Price API v3 · Jupiter Tokens API v2 |
| Wallet and sign-in | Standard Solana wallets · Privy (Sign-In With Solana) |
| Frontend | Being rebuilt on the [design system](Docs/design-system/README.md) · at `victy.finance` |
| Backend | Node.js 22, TypeScript, Fastify · on Render, at `api.victy.finance` |
| AI | OpenAI with structured outputs, validated with Zod and deterministic checks |
| Data | PostgreSQL on Neon · Redis (Render Key Value) for quotas |
| Bot protection | Cloudflare Turnstile |
| Tests | `node:test` with PGlite (backend) |

## Running locally

### Backend

Prerequisites: [Docker](https://www.docker.com/).

```bash
cp backend/.env.example backend/.env    # fill in AI_API_KEY, PRIVY_*, SOLANA_RPC_URL, etc.
docker compose up --build               # API on port 3001, plus PostgreSQL and Redis
```

Without Docker: `cd backend && npm ci && npm run dev` (needs Postgres and Redis running). Tests:
`npm test` — they use fakes and an in-memory Postgres, no services needed.

## Deploy

The API and Redis run on Render ([`render.yaml`](render.yaml)) and Postgres on Neon. The frontend will
be published at `victy.finance`, calling the API at `api.victy.finance`.

## Roadmap

Phases describe priorities, not committed dates.

### 1. VicTy API and real execution

- [x] API contract for the MVP journey ([OpenAPI](Docs/api/openapi.yaml)).
- [x] Anonymous sessions, wallet sign-in and AI quotas.
- [x] Interpretation with scope gate and input/output checks.
- [x] Asset Registry and deterministic composition validator.
- [x] Composition proposals and draft validation.
- [x] Suggested theses, interpretation corrections and instrument details.
- [x] Plans tied to the wallet.
- [ ] Verify mints, availability, eligibility and liquidity of executable instruments.
- [ ] Jupiter quotes and individual, wallet-signed buys and sells, without duplicate operations.
- [ ] Position and activity reconciled with on-chain data.
- [ ] Web app built on the API contract and the design system.

### 2. SocialFi — strategies as shareable content

- [ ] Persist public strategies, authorship and versions.
- [ ] Discovery, following and adaptation of other creators' strategies.
- [ ] Separate simulation history from verified execution results.
- [ ] Transparent criteria for discovery and rankings.
- [ ] Execution attribution and creator compensation.

### 3. API-first — partner distribution

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

## Disclaimer

VicTy is under development. Portfolio proposals and simulations do not promise returns, and nothing
here is investment advice. Instruments have their own risks and access conditions, which must be
assessed before real execution.
