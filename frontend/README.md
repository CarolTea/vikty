# VicTy web app

React 18 + TypeScript + Vite, with i18next for all on-screen text.

## Run

```bash
npm ci
npm run dev
```

Copy `.env.example` to `.env.local` to configure the API:

- `VITE_API_MODE=mock` (default): runs on the contract examples, no backend needed.
- `VITE_API_MODE=real` (or anything other than `mock`): calls the real API at `VITE_API_URL`.

Checks: `npm run typecheck`, `npm run lint`, `node scripts/check-storage.mjs`, `npm test`, `npm run build`.

## Conventions

1. **Components are reused, never copied.** Need a different look or behavior? Add a variant to the existing component.
2. **Every on-screen string lives in `src/i18n/locales/<lang>/<namespace>.json`.** No literal text in JSX or user-facing attributes; lint enforces it.
3. **Browser storage is only for UI preferences** (in `src/lib/preferences.ts`). Business data comes from the API.
4. **Screens are built against the mock first** (the contract examples), then switched to the real API in the single API client, with no screen changes.
