# VicTy

> **Invest in a thesis, not a ticker.**
>
> VicTy turns what you believe into an investment you understand.

VicTy starts from one question — **"What do you believe in?"** — and turns an economic or
technological conviction into a composition of assets on Solana that people understand before they
invest. Each asset comes with why it is there, what it actually represents and what role it plays in
the thesis. Buying and selling happen one asset at a time, always authorized by the user's own wallet.

🚧 **Under construction** — MVP built for a hackathon.

## How it works

1. **Conviction** — the user describes what they believe in or picks a suggested thesis.
2. **Interpretation** — VicTy translates the idea into economic exposures and shows how it understood it.
3. **Composition** — a proposal of assets, built only from approved instruments, with the role and
   weight of each one. The user can reject assets and adjust weights.
4. **One operation at a time** — each buy or sell is reviewed (price, fees, slippage, expiry) and
   signed in the user's wallet, one operation at a time.
5. **Tracking** — the real position per thesis: plan versus executed, based on what actually happened
   on-chain.

## Principles

- **Non-custodial.** VicTy never has access to the user's keys or funds. Every transaction is signed
  in the investor's own wallet.
- **You decide every operation.** No automatic execution of the composition, no rebalancing, DCA or
  scheduled orders.
- **Approved instruments only.** The AI interprets the conviction but doesn't pick tokens freely: the
  composition is built from a curated list of verified instruments.
- **Honest numbers.** No data, no number. When a price is missing or information is limited, the
  interface says so instead of estimating.
- **No promise of returns.**

## What VicTy is not

- Not a swap interface or a token list — the unit is the conviction, not the asset.
- Not an automated robo-advisor.
- Not custodial.

## Stack and integrations

| Layer | Technology |
|---|---|
| Blockchain | Solana (mainnet) |
| Execution | Jupiter Swap API v2 (`/order` + `/execute`) |
| Prices and metadata | Jupiter Price API v3 · Jupiter Tokens API v2 |
| Wallet | Standard Solana wallets |
| Frontend | Lovable, at `victy.finance` |
| Backend | Node.js + TypeScript + Fastify, on Render (`api.victy.finance`) |
| Database | PostgreSQL on Neon · Redis (Key Value) on Render |

## Repository layout

```
.
├── backend/            # API: interpretation, composition, quotes and operation records
│   ├── Dockerfile
│   └── .env.example
├── frontend/           # Web app
│   └── .env.example
├── docker-compose.yml  # Local environment (backend + PostgreSQL)
├── render.yaml         # Deploys the API and Redis on Render
└── Docs/               # Product documentation
```

## Running locally

> The application code is still being written; the steps below apply once the backend and the
> frontend have their first version.

Prerequisites: [Docker](https://www.docker.com/) and a [Jupiter API](https://developers.jup.ag/) key.

```bash
cp backend/.env.example backend/.env    # fill in JUPITER_API_KEY, SOLANA_RPC_URL, etc.
cp frontend/.env.example frontend/.env

docker compose up --build               # starts the backend (port 3001) and PostgreSQL
```

## Deploy

The API runs on a free Render web service, built from `backend/Dockerfile`; Redis on a free Render
Key Value instance; Postgres on Neon. All of it is described in [`render.yaml`](render.yaml).

1. **Neon:** create the project in the AWS `us-east-1` region (close to Render's `virginia` region)
   and copy the *pooled* connection string, with `?sslmode=require`.
2. **Render:** New → Blueprint → this repository. It creates `victy-api` and `victy-redis` and asks
   for the secrets marked `sync: false` (`DATABASE_URL` is the Neon one). `SESSION_SECRET` is
   generated. Migrations run on their own when the API starts.
3. **Domain:** in `victy-api` → Settings → Custom Domains, add `api.victy.finance` and create the
   CNAME record Render shows in your DNS.
4. **Frontend (Lovable):** call `https://api.victy.finance/api/v1` with `credentials: 'include'`.
   Frontend and API on the same domain (`victy.finance`) let the anonymous session cookie work; in
   the Lovable preview (`*.lovable.app`) it isn't sent, so test the anonymous flow on the real domain.
   Another origin for the frontend? Add it to `WEB_ORIGIN`, comma-separated.
5. **Keep it awake:** the free plan sleeps after 15 min without traffic (~1 min to wake up). Create
   the repository variable `API_HEALTH_URL` = `https://api.victy.finance/health` (Settings → Secrets
   and variables → Actions → Variables) and the `Keep API awake` workflow sends a GET every 10 min.

## Disclaimer

VicTy runs on Solana mainnet with real money. Nothing here is investment advice.
