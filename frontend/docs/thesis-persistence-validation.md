# Thesis persistence audit and validation

Scope: demo → simulated investment → email authentication → saved thesis → dashboard → detail. Wallet/signature behavior, AI/catalog/price/execution/performance providers and visual styles are unchanged.

## Audit before this change

| Requirement | Finding before changes | Correction / verification |
| --- | --- | --- |
| First authenticated save | Profile, thesis, composition, assets and snapshots were separate requests; failures could leave partial rows. | One transaction, success only after all writes commit. |
| Reload / logout / login | Saved rows were read from the database and auth/cache were user scoped. A partially saved record could still look successful. | Preserve reads; reject incomplete detail; verify RLS in local Postgres. Actual email round trip needs manual test. |
| Multiple theses | Schema permits several sessions per user, but New thesis resumed the old session. | New thesis requests a fresh session. |
| Start over | Reset content but retained session credentials; save returned the old thesis ID. | Create a new server session before replacing local state; explicit error if changed content reuses a saved session. |
| Owner isolation | RLS and composite owner FKs already exist. Server identity comes from verified auth claims. | Preserve policies; test reads for two accounts on all four tables. RPC callable only by service_role. |
| Missing / foreign detail | UUID queries use auth/RLS and return no row for missing/foreign IDs. Malformed IDs produced validation errors. | Malformed IDs now return not-found too; database failures remain errors. |
| Failed saves | Existing thesis ID was returned without checking child rows; invalid pending data was silently ignored. | Check completeness; repair partial legacy saves atomically; visible errors and explicit retry. |
| Tracking confirmation | Demo correctly said wallet approval verified, not persistence confirmed. | Tracking confirmation appears only after complete thesis detail loads from the database. |
| Stable performance | Read endpoints did not regenerate performance; mock is seeded. | Keep provider unchanged; complete retries do not rewrite persisted values. Repairs use original thesis creation date. |
| Duplicate actions | Component ref blocked a single dashboard effect but did not cover concurrent requests/tabs. | Immediate click locks; session-scoped transaction lock and idempotency; serialized demo sync. |

Additional issues addressed: unchecked `{ ok: false }` demo sync; pending save not associated with session/account; one-character email-prefix fallback violating profile name length; missing handling of profile read errors. Logout clears pending save intent; it does not delete persisted theses.

## Migration and deployment

Apply `drizzle/migrations/0006_atomic_thesis_save.sql` through Lovable before publishing the new application code. Do not reapply old migrations. The migration adds one `SECURITY INVOKER` RPC and permissions; no tables, columns, RLS policies or Solana objects change. The owner confirmed 0005 previously; 0006 has only been applied to a disposable local Postgres in this task.

`save_tracked_thesis_atomic` is callable only by service_role. The authenticated server function verifies the demo capability secret and derives owner/email from verified auth context before calling it. Neither the browser nor the RPC caller can use a client-supplied user ID through the application endpoint. Complete retries preserve the original thesis and performance. Reused sessions with changed content or a different owner return an error. Incomplete legacy saves can be repaired by retrying the original demo; complete saved theses are never deleted during repair.

Database test: `tests/persistence/check.py`. It requires an EMPTY, disposable Postgres container and refuses to run when public tables already exist. It applies actual project migrations, then tests first save, retries, content conflicts, two theses per account, other-account conflicts, rollback of a final snapshot failure, four concurrent requests, repair of an incomplete legacy thesis, owner-scoped reads and RPC permissions. Auth identities are simulated with the same `auth.uid()` contract in this isolated test; this is not a live Lovable or email/browser E2E test.

Reproduce with the cached Postgres image, sequentially:

```sh
docker run --rm -d --name victy-persistence-test --memory=192m --cpus=1 -e POSTGRES_PASSWORD=local-test-only postgres:16-alpine
# Wait until pg_isready succeeds, then:
python3 tests/persistence/check.py victy-persistence-test
docker stop victy-persistence-test
bun run build
bun run lint
bunx tsc --noEmit
bun test tests/
```

## Manual test: two accounts, two theses in account A

Use desktop browser profiles A and B with separate email accounts. Use the already-working wallet flow; no funds are needed. Apply migration 0006, publish, and refresh first.

1. Signed out in profile A, create thesis A1 and simulate an investment. Click View my thesis several times quickly. Expect one navigation, email authentication and then a complete saved detail. The tracking confirmation must appear only after saving. Record detail URL, title, asset allocations, current value and chart values.
2. Reload detail and dashboard. Log out, then log in via email without running the demo again. A1 must still appear with the same URL/assets/performance. No new save should be triggered just by logging in.
3. Select New thesis. Confirm an empty demo. Create distinct thesis A2, simulate, and save. Its URL must differ from A1, and the dashboard must contain both. Reload and log in again; both must remain unchanged.
4. Return to the demo and use Start over. Confirm a fresh session ID in `victy_demo_session_v1` (do not share its secret). The previous saved theses must remain. Failure to create a new session must keep the old demo and show an error, never silently reset it using old credentials.
5. In profile B, log in with account B. A1 and A2 must not appear. Paste their detail URLs: expect Thesis not found, with no content from A. Also test a valid nonexistent UUID and an invalid ID. Create B1 and confirm only B1 appears for B; A still sees only its own theses.
6. During a save, interrupt the network. There must be no tracking success message. Restore connectivity and use Retry saving or reload. Whether the original transaction committed before the interruption or not, the result must be exactly one complete thesis with stable performance.
7. In two tabs for account A, open the same pending demo and request saving at nearly the same time. Expect one saved thesis ID. Retry a completed save: performance and row counts must not change.
8. If an old incomplete thesis exists, open its original demo and retry View my thesis. It should be repaired and retain its thesis ID. A changed demo reusing a previously saved session must show an explicit error directing the user to Start over, never display the old thesis as a new successful save.

Do not paste email links, auth tokens or demo session secrets into reports. Record visible result, thesis ID and any error text only.

## Results for this change

- Actual PostgreSQL migration/transaction/RLS suite: all 11 checks passed, including an added regression rejecting extra assets on an already-complete thesis.
- Existing Bun suite: 24 passed, 0 failed.
- Final sequential checks: build exit 0, full lint exit 1, TypeScript exit 0.
- Full lint: 732 errors and 13 warnings remain in existing files. Behavior files changed here pass ESLint. Generated Supabase types have exactly 324 lint errors both before and after the four-line RPC type addition; unrelated generated formatting is preserved.
- No live database mutation, email login or browser E2E validation was performed. Apply 0006 and run the manual checklist before treating production as verified.
