# VicTy

> **Invest in what you believe.**
>
> Turn ideas into strategies. Understand your choices. Invest on your terms.

People have beliefs about the future, but turning a conviction into an investment decision requires knowledge of assets, risks, and markets. **VicTy bridges that gap:** it starts with an idea, identifies the economic exposures behind it, and proposes a portfolio people can understand and adjust.

Our vision also makes these strategies shareable: discover ideas from other creators, understand their rationale, adapt them, and decide how to participate. Through the VicTy app or, eventually, within partner wallets and platforms.

**Built by women. Built for independent decisions.**

[Explore VicTy](https://victy.finance) · [Try the demo](https://victy.finance/demo) · [Roadmap](#roadmap) · [Local development](#local-development)

## From belief to portfolio

> “I believe artificial intelligence will increase demand for energy.”

VicTy helps explore what that idea means economically, which instruments in the catalog can represent it, and where that representation falls short. Each asset comes with an explanation of its role and risks.

1. **Express a belief.** Describe your idea and answer clarifying questions when needed.
2. **Review the interpretation.** Examine the identified economic exposures and their limitations.
3. **Explore the portfolio.** Review proposed assets, adjust allocations, and ask VicTy questions.
4. **Approve a simulation.** Connect a compatible wallet and sign an approval message.
5. **Save your thesis.** Sign in by email to access your theses in a private dashboard with illustrative tracking.

The thesis is the foundation of the experience: users should understand why each instrument belongs before making a decision about it.

## Three pillars

| Pillar | Purpose | Status in this repository |
| --- | --- | --- |
| **Thesis Engine** | Translate beliefs into understandable portfolios, with rationale and limitations. | Implemented in the demo, with an AI integration and a curated catalog for simulation. |
| **SocialFi** | Discover, share, and adapt strategies from creators and communities. | Demonstration interface, examples, and in-memory publishing for the current session. A persistent network and creator compensation are on the roadmap. |
| **API-first** | Bring VicTy intelligence to wallets, apps, fintechs, and agents. | An architectural and distribution direction. This repository does not yet provide a public partner API. |

## What works today

This repository contains the **VicTy demonstration MVP**, built for a hackathon. It includes the web application and its server functions.

| Feature | Current implementation |
| --- | --- |
| Landing page and early access | Product presentation and persistent registration. |
| AI conversation | OpenAI integration for clarification, interpretation, portfolio proposals, and explanations, subject to server configuration. |
| Instrument catalog | Curated selection and validation of proposed assets. Reference prices are fixed demonstration data. |
| Demo sessions | Persistent anonymous sessions with their own credentials. |
| Solana wallet | Discovery, connection, and real message signing, with server-side cryptographic verification. |
| Accounts and private theses | Email login, thesis saving, and owner-scoped queries. |
| Dashboard | Saved portfolios and deterministic simulated performance. |
| Public strategies | Demonstration examples and temporary publishing within the open session. |

**The demo does not execute real investments.** Wallet signing happens off-chain: it does not submit transactions, perform swaps, or move funds. The `solana:devnet` label defines the approval context; it is not evidence of on-chain execution. No SOL balance is required to sign this message.

Routes labeled **Jupiter demo**, prices, and performance are simulated. An instrument's inclusion in the catalog does not establish trading availability on Solana, liquidity, or user eligibility. These must be verified before integrating real execution.

## Product principles

- **Understand before investing.** Explain the relationship between a thesis, an instrument, and its risks in accessible language.
- **User decisions.** AI-proposed changes require explicit review and application. Future execution will require individual wallet authorization.
- **Asset control.** The proposed architecture is non-custodial; the application does not request private keys.
- **A bounded catalog.** AI works with curated candidates, and the server validates returned assets and allocations.
- **Visible limitations.** A thesis with insufficient coverage should receive an explanation, without filling the portfolio with unrelated assets.
- **Clearly identified results.** Simulations and illustrative data do not represent observed returns.

## Architecture

```text
React / TanStack Start application
  ├── Landing page and strategy discovery
  ├── Demo: belief → interpretation → portfolio
  ├── Wallet: connection and message signing in the browser
  └── Private dashboard
          │
          ▼
TanStack server functions
  ├── Thesis Engine → OpenAI provider + catalog validation
  ├── Sessions, challenges, and approval verification
  └── Authentication and persistence → Supabase / PostgreSQL
```

Provider interfaces separate AI, wallet, catalog, pricing, and execution services from the visual interface. This allows integrations to evolve while preserving the user experience.

| Layer | Technology |
| --- | --- |
| Interface | React 19, TypeScript, Tailwind CSS 4, Radix UI, and Motion |
| Application and routing | TanStack Start, TanStack Router, and React Query |
| Build | Vite and Lovable-integrated configuration |
| AI | OpenAI SDK, structured outputs, and Zod validation |
| Data and authentication | Supabase, PostgreSQL, and owner-scoped access policies |
| Migrations | Versioned SQL in `drizzle/migrations/` |
| Solana wallet | `@solana/kit` and `@solana/kit-plugin-wallet` |
| Tests | Bun, TypeScript tests, and persistence validation in isolated PostgreSQL |

### Solana in the MVP

The client uses `createClient().use(walletSigner(...))` to discover and connect wallets supporting `solana:signMessage`. The server issues a challenge with a nonce, expiration, and bindings to the session, origin, wallet, and simulated operation. The Ed25519 signature is verified before the challenge is consumed exactly once.

This approval is independent of the email login used to save and retrieve theses. This repository has no custom on-chain program or production swap integration.

Details: [wallet approval](docs/solana-demo-wallet.md) and [Thesis Engine](docs/thesis-engine.md).

## Local development

### Prerequisites

- Bun installed; the repository tracks `bun.lock` and configures installation in `bunfig.toml`.
- Access to a Supabase/Lovable Cloud project with its schema and authentication configured.
- An OpenAI key for real AI responses, or explicit mock configuration for development.
- A wallet supporting message signing and the Solana Devnet context to test approval.

### Installation

```sh
git clone https://github.com/CarolTea/victylp.git
cd victylp
bun install --frozen-lockfile
```

Create `.env.local`, which is ignored by Git, with your environment values:

```dotenv
# Public configuration used by the browser
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY

# Server configuration
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_KEY

# AI: also see .env.ai.example
AI_PROVIDER=openai
OPENAI_API_KEY=YOUR_OPENAI_KEY
# Optional: OPENAI_MODEL can override the default model in the code.
```

Keep `SUPABASE_SERVICE_ROLE_KEY` and `OPENAI_API_KEY` exclusively on the server, without a `VITE_` prefix. Configure email login redirect URLs for both the local and deployed origins.

The database must include the migrations from [`drizzle/migrations/`](drizzle/migrations/). Installing dependencies does not provision the database. Check the applied migration history and use the existing Lovable/Drizzle migration workflow; do not reapply migrations or use `supabase db push` as a substitute for that history.

```sh
bun run dev
```

Open the address reported by Vite. The main routes are `/`, `/demo`, `/auth`, and `/dashboard`.

For local mock AI responses, use `AI_PROVIDER=mock` with `NODE_ENV=development`. This mode does not replace the database or other services. Failures in the real integration do not automatically activate mock responses.

### Verification

```sh
bun test tests/
bunx tsc --noEmit
bun run lint
bun run build
```

Automated tests do not replace validation of email login, the wallet extension, and the configured database. See the [persistence checklist](docs/thesis-persistence-validation.md) for tests using separate accounts and a disposable database. That document also records results and limitations of earlier checks; they do not guarantee the state of the current deployment.

The `tests/evaluate-thesis.ts` and `tests/evaluate-scope.ts` scripts are optional evaluations that make paid AI calls, explicitly enabled with `--live` and credentials. They are not required to explore the interface.

### Repository structure

```text
src/
├── routes/                # Landing, demo, authentication, and dashboard
├── components/            # Interface and reusable components
├── lib/
│   ├── ai/                # Engine, prompts, schemas, and AI provider
│   ├── assets/            # Curated catalog and candidate selection
│   ├── demo/              # Sessions, providers, and simulation approval
│   ├── strategies/        # Examples and in-memory social publishing
│   ├── thesis/            # Types, queries, and illustrative performance
│   └── wallet/            # Browser-side Solana integration
└── integrations/supabase/ # Clients, authentication, and database types
drizzle/migrations/        # SQL history
tests/                     # Tests and optional evaluations
docs/                      # Technical decisions and validation checklists
```

## Roadmap

The phases below describe development priorities without committed dates. Completed items refer to implementations present in the code; availability depends on environment configuration and validation.

### 1. Demonstration experience — foundation implemented

- [x] Visual identity, landing page, and early-access registration.
- [x] Interactive belief, clarification, and portfolio journey.
- [x] Thesis Engine with AI integration, curated catalog, and response validation.
- [x] Anonymous session persistence.
- [x] Wallet connection and cryptographic approval of simulations.
- [x] Email login, private theses, and a dashboard with illustrative performance.
- [x] Demonstration interface for strategy discovery and publishing within the session.
- [ ] Complete end-to-end validation of the deployed environment and the presentation walkthrough.

### 2. Real execution and tracking

- [ ] Verify mints, availability, eligibility, and liquidity for executable instruments.
- [ ] Integrate live prices and quotes with explicit expiration and costs.
- [ ] Integrate Jupiter for individual wallet-authorized purchases and sales.
- [ ] Handle transaction rejection, expiration, failure, and confirmation without duplicate operations.
- [ ] Associate confirmed transactions with theses and reconcile executed quantities.
- [ ] Replace illustrative performance with tracking based on verifiable data.

### 3. SocialFi — strategies as shareable content

- [ ] Persist public strategies, authorship, and versions.
- [ ] Enable discovery, following, and adaptation of other creators' strategies.
- [ ] Separate simulation history from verified execution results.
- [ ] Define transparent criteria for discovery and rankings.
- [ ] Validate execution attribution, rules, and creator compensation.

### 4. API-first — partner distribution

- [ ] Expose versioned contracts for thesis interpretation and portfolio composition.
- [ ] Provide partner authentication, quotas, observability, and documentation.
- [ ] Offer integration examples for wallets, applications, and agents.
- [ ] Validate the commercial model and partner pilots.

The [original implementation roadmap](roadmap.md) records the initial interface and persistence milestones.

## Business model under validation

The commercial vision considers three potential revenue streams:

1. **Execution:** a transparent fee on volume actually executed through VicTy integrations.
2. **Strategies:** a creator share of revenue from executions attributed to their strategies.
3. **API:** usage fees, licensing, or revenue sharing for partner integrations.

Pricing, revenue sharing, and economic viability are still being validated. The demo does not implement billing or creator compensation. The proposed metric, **Thesis Volume**, represents financial volume actually executed from theses; simulated amounts do not count toward it.

## Documentation and contributing

- [Thesis Engine and catalog](docs/thesis-engine.md)
- [Solana wallet and simulation approval](docs/solana-demo-wallet.md)
- [Persistence, user isolation, and manual tests](docs/thesis-persistence-validation.md)
- [Repository guidelines](AGENTS.md)
- [Lovable project](https://lovable.dev/projects/1f73bb9a-bf1c-4531-8dd9-02e54c881eea)

This repository is connected to Lovable. Preserve published history: do not force push or rewrite commits that have already been pushed. Changes to the connected branch sync with the editor. When contributing, keep integrations behind provider interfaces and preserve owner-scoped authorization for thesis access.

---

VicTy is under development. Portfolio proposals and simulations do not promise returns. Instruments have their own risks and access conditions, which must be assessed before real execution.
