# VicTy: real wallet approval, simulated investment

## Scope

Wallet discovery, connection, the public address and an off-chain Ed25519 approval are real. The investment, Jupiter route, assets, prices, AI and performance remain simulated. There is no Solana RPC, transaction submission, swap, token creation, fee payment or transfer. Email authentication remains independent.

Dependencies pinned with Bun:

- `@solana/kit`: `8.4.0`
- `@solana/kit-plugin-wallet`: `0.20.0` (Kit peer range `^8.2.0`)

`@solana/react` is an optional peer for the plugin's React hooks. The implementation uses the framework-independent namespace behind the application's interface, so it is not a direct dependency. No legacy Wallet Adapter is used.

The Solana MCP was consulted before implementation. Relevant references:

- https://solana.com/docs/frontend/react-hooks
- https://solana.com/docs/frontend/messages-and-auth
- Installed `@solana/kit-plugin-wallet/README.md` and public TypeScript declarations for the pinned version.

## Provider boundary

`CompositionWorkspace` receives ordinary application types and callbacks. It never imports a Solana library.

`WalletProvider` defines discovery, connection, disconnection, subscription and `signApproval`. `SolanaWalletProvider` wraps `createClient().use(walletSigner(...))`, `client.wallet.getState()`, `subscribe`, `connect`, `disconnect` and `signMessage`.

The provider is dynamically imported through TanStack's `createClientOnlyFn` and instantiated in a React effect. This also keeps the wallet package out of the Lovable Cloudflare server build. No extension or browser storage is touched during SSR. The Kit client is created only upon discovery, and disposed when the route unmounts.

Only `solana:devnet` and wallets/accounts supporting `solana:signMessage` are accepted. Selection buttons appear when multiple wallets are found, using existing UI components and styles. No automatic connection or persisted approval is restored on reload.

Devnet is the application context and advertised account capability. Signing a message is off-chain and does not prove an on-chain transaction or change the wallet extension's selected RPC network.

## Challenge and verification

1. The browser requests a challenge with the current demo credentials, public address, asset and simulated allocation.
2. The server verifies the existing demo session capability secret, validates the public address and allocation, and creates a random 32-byte nonce plus a challenge UUID. Expiry is five minutes.
3. The server stores the immutable challenge in `demo_wallet_approval_challenges`. It contains the address, session, origin, Devnet context, asset, amount and timestamps. Neither session secrets nor wallet secrets are stored in this table.
4. The provider checks the returned address, context, asset, amount and origin, then asks the wallet to sign the canonical human-readable message.
5. The browser submits only the challenge ID, public address, 64 signature bytes and existing demo credentials.
6. The server authenticates the demo session again, retrieves the challenge, checks session/address/origin/expiry, reconstructs the message, and verifies Ed25519 using Kit's `getPublicKeyFromAddress`, `signatureBytes` and `verifySignature`.
7. The service-role-only SQL function `consume_demo_wallet_approval` atomically updates an unused, unexpired challenge. Database time is checked during consumption. Concurrent verification requests cannot both consume it.
8. Only the successful consumer calls `MockExecutionProvider`, returning `simulated`, the verified address, `walletApproval: "verified"`, `network: "solana:devnet"`, `approvedAt` and provider `Jupiter demo`.

There is no public endpoint accepting a wallet-connected/approved boolean. A failed or lost verification response requires a fresh challenge and approval; a consumed challenge is never accepted again. No signature is presented as an on-chain transaction hash or linked to Explorer.

Connection/signature rejection, missing wallet, disconnection, account changes and unexpected errors have friendly messages. An immediate lock prevents duplicate approvals. An account change invalidates pending/current approval; completion for an obsolete account does not become UI success.

The existing demo history remains browser-editable simulation data; its optional approval metadata is never trusted for authorization or used to restore the provider's `approved` state.

## Lovable setup before testing

Apply **once**, using the existing Lovable/Drizzle migration workflow:

`drizzle/migrations/0005_demo_wallet_approval_challenges.sql`

Its journal entry and empty-schema metadata follow the repository's existing custom migration convention. The project owner confirmed applying this migration in Lovable on 2026-10-02; the agent has not independently queried the remote schema. Do not apply it again. Do not run `supabase db push` for the old migrations: the project's migration history lives in `drizzle/migrations`.

The migration adds one table and one `SECURITY INVOKER` function. RLS is enabled; `PUBLIC`, `anon` and `authenticated` have no table/function access. Only the existing server-side service role can issue, read or consume challenges. No existing tables or email authentication policies are changed.

Keep these existing server variables configured in Lovable:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` — server only, never `VITE_*`
- `SUPABASE_PUBLISHABLE_KEY` — existing auth middleware

Keep the existing browser `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. No Solana RPC key, wallet secret or additional environment variable is required. Use HTTPS in deployment; HTTP localhost/127.0.0.1 is accepted for local development. Requests remain behind the existing TanStack CSRF middleware and are bound to their browser origin.

Expired rows remain unusable. For retention, operators may periodically delete expired challenge rows; no scheduler or automatic cleanup service was added in this stage.

## Manual test (Phantom or another compatible wallet)

1. Apply the migration and ensure the existing backend variables are set. Open the deployed demo over HTTPS, or run it locally with the required server environment.
2. In Phantom, enable test networks/select Solana Devnet. No SOL or airdrop is needed.
3. Complete `/demo` until the composition appears. Click **Connect wallet**, choose a wallet if needed, and accept its connection prompt. Confirm the abbreviated address and **Solana Devnet** label.
4. Click **Invest** for a nonzero allocation, review the demo and click **Approve simulation**. Inspect the wallet's message: VicTy, origin, Devnet context, asset, amount, address, session, nonce and expiry.
5. Sign. Expect **Wallet approval verified** and **Investment simulated**. No Explorer link or transaction confirmation should appear.
6. Repeat while cancelling connection/signature. Confirm a friendly error, no success state and ability to retry.
7. Switch wallet accounts or disconnect during approval. The old approval must not become success; reconnect/review before trying again.
8. Try repeated approval clicks: only one wallet prompt/verification should proceed. Refresh: wallet approval must not be restored from the saved demo state.

The wallet does not replace the email login when saving/viewing the thesis dashboard.

## Technical validation

Run sequentially on this machine:

```sh
bun install
bun test tests/
bunx tsc --noEmit
bun run lint
NODE_OPTIONS=--max-old-space-size=768 RAYON_NUM_THREADS=1 UV_THREADPOOL_SIZE=2 bun run build
```

Tests use the native Bun runner, real ephemeral Ed25519 test keys, and in-memory wallet/store doubles. They cover valid/invalid signatures, expiry, replay, concurrent consumption, wrong wallet/session/origin/context, altered amount, wallet rejection, account changes and SSR-safe construction. They do not replace a live database migration test or a manual extension test.

No Chrome DevTools MCP was used for implementation validation. The full-project lint currently reports pre-existing formatting errors, one `prefer-const` error in `previewAuthStorage.ts`, and Fast Refresh warnings. Changed TypeScript files are checked separately; unrelated files are left untouched.
