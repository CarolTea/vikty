# VicTy Thesis Engine — catalog v2

## Architecture

Existing UI → TanStack server function → verified demo session → AIProvider → OpenAIProvider → Responses API. `AIProvider` exposes clarify, interpret, proposeComposition and answer. Production defaults to OpenAI. Explicit `AI_PROVIDER=mock` is accepted only when `NODE_ENV=development`; configuration/API failures never silently substitute fixtures.

Catalog version: `2026-10-06.v2`. Prompt version: `victy-thesis-v4`. SDK: official `openai@7.25.0` pinned in package.json and bun.lock. Version 7.27.0 was rejected by the project's minimum-release-age policy; that policy was preserved. Model defaults to `gpt-5.6-luna` and can be set with OPENAI_MODEL.

Flow:
1. Clarify a material ambiguity, ideally 1–2 questions, at most 3. Complete history up to 8 messages is included; a ready initial answer skips questions.
2. Interpret economic exposures, using canonical tags for recognized concepts. Unsupported concepts remain explicit.
3. Deterministically rank enabled catalog instruments by exact theme/exposure tags and documented aliases. Prioritize primary exposures, retain a representative of each exposure, and cap candidates at 15. Never pad with unrelated instruments. Fewer than 8 candidates produces an explicit limitation.
4. Request a composition from the candidate subset only. Missing primary coverage bypasses the composition call and returns no portfolio with an explicit explanation.
5. Parse with official `responses.parse` and `zodTextFormat`. Validate IDs, enablement, uniqueness, integer allocations in 5-point increments, ranges and total again. A total below 100 requires explicit limitations; above 100 is rejected. Normally propose 3–6 assets; fewer requires a limitation when more matching candidates exist.
6. Hydrate all asset identity, price fixture, availability and instrument category from the catalog. Display using existing cards; no auto-investment or wallet operation.
7. Ask VicTy uses relevant economic context and static catalog fields only. Explanation-only output cannot carry changes. A proposed change describes all existing positions, leaves rejected assets at zero, and is previewed until Apply proposal is clicked. Changed allocations invalidate a stale pending proposal; the server never mutates a portfolio from a model answer.

## Catalog (35 instruments)

All entries are enabled for simulation, chain=`solana` as the intended VicTy universe, executionStatus=`demo-only`. This does not assert verified live deployment or trading availability for each token. Identity metadata is curated manually; individual chain deployment, issuer/eligibility and execution availability must be verified before future real integrations. No addresses, scraping jobs, external asset API or live quote feed are included.

| Category | Entries |
| --- | --- |
| Tokenized equity (18), Ondo | NVDAon, AMDon, AVGOon, TSMon, MSFTon, AAPLon, GOOGLon, AMZNon, METAon, VRTon, NEEon, CEGon, XOMon, Von, MAon, PYPLon, CRCLon, PBRon |
| Tokenized ETF (8), Ondo | SPYon, QQQon, SMHon, XLUon, XLEon, GLDon, TLTon, SGOVon |
| Tokenized ETF (1), Backpack | EWZ |
| Digital asset (1), Solana | SOL |
| Stablecoin (3) | USDC (Circle), PYUSD (Paxos / PayPal brand), BRZ (Transfero) |
| Tokenized fixed income (2), Ondo | USDY, OUSG |
| Tokenized fixed income (2), Etherfuse | TESOURO (BRL), CETES (MXN) |

The type system also supports tokenized_commodity; GLD is classified as a tokenized ETF, not direct physical gold. Themes/exposures cover AI, chips, cloud, power generation, data-center power/cooling, US equity, Nasdaq, gold, Treasuries, payments, stablecoins, blockchain settlement, Solana and tokenized instruments. RWA adoption is not equated with a claim on an issuer's business profits. Stablecoins are not equity, and tokenized shares are not direct stock ownership.

Required fields: id, ticker, displayTicker, name, instrumentType, provider, chain, themes, exposures, riskTags, executionStatus, enabled. Description, underlying, providerUrl, notes and explicit demoPrice fixtures supplement those fields. IDs/tags use kebab-case. Curated prices are not market prices; existing mock values for NVIDIA/AMD/SOL/USDC are retained, with a nominal 100 fixture for most newly represented instruments.

Manual source references (research only; no application requests):
- https://ondo.finance/blog/global-markets-live-on-solana
- https://ondo.finance/blog/real-24-7-trading-for-tokenized-stocks
- https://app.ondo.finance/assets/NEEon
- https://app.ondo.finance/assets/GLDon
- https://app.ondo.finance/assets/SGOVon
- https://app.ondo.finance/assets/VRTon
- https://ondo.finance/usdy
- https://ondo.finance/ousg
- https://www.circle.com/multi-chain-usdc/solana
- https://developer.paypal.com/community/blog/pyusd-solana-token-extensions/
- https://solana.com/learn/introduction-to-solana-tokens

Per-entry providerUrl records the intended reference page; not every page's live content or per-chain listing was independently verified. Inaccessible/unchecked listings are curated demo candidates, not proof of current availability. No current prices, liquidity, news or returns were copied from source pages.

## Schemas / trust boundaries

- Clarification: ready, nullable question, options, reason.
- Interpretation: summary, exposures(id/name/description/importance), limitations.
- Composition: summary, assets(assetId/allocation/whyHere/riskContext), limitations.
- Answer: kind(EXPLANATION_ONLY/PROPOSED_CHANGE), explanation, changes(assetId/allocation/whyHere/riskContext), limitations.

All output objects are strict Zod schemas. Model metadata, unknown asset IDs, duplicate IDs, disabled/noncandidate instruments and invalid totals are rejected. Qualitative explanations still require live evaluation; structured validation is not a guarantee that every generated statement is factually correct. The prompt forbids current market claims and treats user instructions as untrusted data.

The model never receives session secrets, wallet addresses, email/auth tokens, investment history, prices, performance or full application state. Only server-generated trusted catalog metadata is supplied for current assets; old saved compositions with unknown catalog IDs remain readable/persisted but Ask VicTy asks the user to start a new demo rather than fabricate metadata.

Costs: belief ≤2000 characters; question ≤1000; history ≤8 messages; payload ≤36000 characters; clarification output ≤1000 tokens, interpretation ≤3000, composition/answer ≤3500. Reasoning effort low; 20s timeout per attempt; official SDK maxRetries=1 for retryable errors. No model tools, agents, autonomous loops, or background calls. A best-effort per-worker gate allows one in-flight request and 30 requests/10min per valid demo session. It is not a distributed billing quota; use OpenAI project spend limits for a public deployment.

Telemetry includes operation, model, latencyMs, inputTokens, outputTokens and status only. No raw prompts, outputs or API error bodies are logged. Responses use store=false.

## Lovable configuration

Configure server-only OPENAI_API_KEY and OPENAI_MODEL=gpt-5.6-luna. AI_PROVIDER defaults to openai; leave it unset or set openai. Never configure VITE_OPENAI_API_KEY. Preserve the existing Supabase secrets. No schema migration, new login provider, wallet change, Jupiter integration or deployment of contracts is needed for this engine. Existing persistence migration 0007 from Lovable was preserved.

For local explicit fixtures only: use AI_PROVIDER=mock with NODE_ENV=development in ignored .env.local. `.env.ai.example` contains names/placeholders only.

After setting secrets and confirming model access/billing, publish the synchronized application. Missing key/access, quota failures, refusals, timeout and invalid outputs surface recoverable errors. The user can retry without losing their thesis or receiving fake AI content.

Official OpenAI references:
- https://developers.openai.com/api/docs/guides/structured-outputs
- https://developers.openai.com/api/docs/models/gpt-5.6-luna

## Tests and manual evaluation

Offline: `bun test tests/` exercises the official SDK with a controlled HTTP transport (not a live model), schemas, catalog selection, injection-like IDs, allocation failures, proposal non-mutation, missing output, retry limit and privacy of inputs. Nine scenarios live in tests/fixtures/thesis-cases.ts. Two full engine fixtures demonstrate distinct compute/electricity portfolios.

Optional paid evaluation, explicit opt-in only: `bun tests/evaluate-thesis.ts --live`, with a server OPENAI_API_KEY. It runs the sixteen fixed cases sequentially and reports case ID, selected IDs, allocation total and limitation count, not raw user text. A human should review output quality and risk explanations; static fixtures alone cannot establish live model quality.

Manual plan after configuring Lovable:
1. Run the original nine fixture beliefs: AI infrastructure, AI electricity, RWA adoption, stablecoin payments, gold, Solana, profit maximization, unsupported lunar hotels, and instruction injection. Confirm clarification is material and never exceeds three questions.
2. Compare compute vs electricity: semiconductor/cloud representation versus power/utilities representation, with explanations and no identical fixed five-asset portfolio.
3. For unsupported/profit/injection cases, check limitations or a clarification rather than fabricated stocks or promised returns. No unsupported asset may appear.
4. Ask “Why is NVDA here?”: explanation only. Ask “Make this less volatile”: visible target allocations; nothing changes before Apply proposal. Dismiss leaves state unchanged. Edit an allocation while a request is pending: its stale proposal must not apply.
5. Reject an asset and ask again: it stays rejected. Verify underallocation is explicit and no unrelated asset is inserted to fill it.
6. Temporarily use an invalid API key/model in a nonproduction preview: expect a recoverable error, no mock fallback, no key in browser/network assets. Restore config and retry.
7. Complete the existing wallet signature, save through email auth, reload dashboard/detail and verify snapshots remain persisted. Start a new demo, create a second thesis and verify both still exist. Solana, performance and execution remain the previous implementations.
8. Confirm all displayed prices, performance, routes and execution are still labeled simulation. No trade or funds movement happens.

### Economic scope gate

Every production OpenAI operation runs a separate structured scope check before generation.
Only `IN_SCOPE` proceeds; `OUT_OF_SCOPE` and `NEEDS_CLARIFICATION` return fixed redirects
in Portuguese or English. Invalid, refused, incomplete or failed checks stop generation.
The three-question clarification limit also runs the gate. Engine wrappers preserve scope
redirects; the existing UI error handling leaves the current thesis and allocations intact.
The development-only mock remains unchanged and does not exercise this production gate.

The gate evaluates intent, including follow-up context, mixed requests and instruction
injection. It must allow economic theses about sports and novel sectors even when the
catalog cannot represent them. User text stays in request input, never in instructions.
Each successful generation now needs one additional API request, adding cost and latency.
A model-based gate is not a guarantee; evaluate it with the configured production model.

Offline enforcement tests: `bun test tests/thesis-engine.test.ts tests/thesis-scope.test.ts`.
Opt-in paid semantic evaluation: provide `OPENAI_API_KEY` in the environment, then run
`bun tests/evaluate-scope.ts --live`. It reports case IDs and outcomes without printing keys
or model responses. No database migration or new dependency is required.


## Regional catalog v2 (2026-10-06.v2)

The original 30 instruments and their existing metadata/fixture prices are retained.
Five curated Solana representations are added: PBRon, EWZ, TESOURO, BRZ and CETES.
MercadoLibre is not part of this version. These sources were checked on 2026-10-06:

- PBRon: https://app.ondo.finance/assets/PBRon — the official page's embedded asset metadata includes a SOLANA deployment. No address is copied into application logic.
- EWZ: https://learn.backpack.exchange/blog/tokenized-ishares-msci-brazil-etf-ewz — official Backpack announcement of Brazilian large/mid-cap exposure on Solana.
- TESOURO: https://etherfuse.com/markets/brazil — BRL sovereign bonds; lists Solana.
- BRZ: https://transfero.com/brz-stablecoin — official Solana deployment; BRL liquidity, not corporate growth or interest-bearing bonds.
- CETES: https://etherfuse.com/markets/mexico — MXN sovereign certificates; lists Solana.

`region` is required; `countryExposure`, `currencyExposure`, `marketExposure` and
`availabilityScope` are optional, and are included in the model's candidate metadata.
Legacy US securities use their primary reference market, not a claim that all revenue is
US-derived. TSM is marked global with Taiwan exposure; SMH, gold and digital instruments
use global where appropriate. Empty country/currency arrays do not claim zero exposure;
they avoid fabricating a full country or currency breakdown. Legacy availability stays
`demo`; the five additions are `provider-specific`. All execution stays `demo-only`.
The five additions reuse the existing nominal `demoPrice: 100` simulation convention.
This is not a market price, FX conversion, BRL/MXN peg value or yield, and is never sent
to the model. No live APY, maturity, liquidity, price feed or token address was added.

Matching operates on semantic exposure IDs, not raw belief keyword searches. The model
identifies exposures; explicit aliases normalize regional concepts. Country themes never
make all instruments in a country interchangeable. Brazil equities can nominate EWZ and
PBRon, with EWZ ranked as the broad representation and PBRon's single-company limitation
explicit. Local-rate exposure nominates TESOURO/CETES; BRL cash nominates BRZ. Economic
drivers such as falling rates do not automatically require bond allocations in an equity
thesis. Every proposed asset still needs a reason and must pass the existing catalog and
candidate allowlists.

Unsupported LatAm ecommerce/fintech, small caps, Mexican equities and MXN cash remain
explicit limitations. TESOURO is now a supported Brazilian fixed-income representation.
Brazil-specific AI/data-center IDs may use global thematic proxies, with an explicit
lack-of-direct-Brazil-exposure limitation. No broad region-prefix removal is used.
Existing handling is preserved: a missing primary exposure prevents a complete portfolio;
a missing secondary exposure remains in limitations. Catalog candidates are eligibility,
not a requirement to allocate to every candidate.

Regional fixtures A–G cover Brazil stocks/rates, Petrobras/oil exports, high Selic, BRL
liquidity, Mexican rates, unsupported LatAm ecommerce and Brazil data centers. Offline
fixtures test deterministic mapping from intended semantic IDs; they do not establish
live model interpretation quality. The optional paid evaluator includes these beliefs.
The hero's secondary CTA now reads `View demo` and links to `/demo` using the existing
button design. Wallet, auth, dashboard, persistence, OpenAI provider implementation and
simulated execution are unchanged.
