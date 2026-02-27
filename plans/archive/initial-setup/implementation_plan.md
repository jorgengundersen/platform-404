# Initial Setup: Hello World Skeleton (Ralph Loop / TDD)

Goal: working minimal web server (HTML + JSON) with tests + pre-commit green; no db/features.

## Non-goals (explicitly NOT now)
- No SQLite (`opencode.db`/`dashboard.db`), migrations, ingestion, stats
- No docker/compose yet (optional later, only if it can be TDDed)
- No auth, no background jobs

## Task Queue (pick top-most incomplete)

- [x] TDD: `GET /api/health` returns 200 + `{ data: { status: "ok" } }`
- [x] TDD: `GET /` returns 200 HTML containing `platform-404`
- [x] TDD: `GET /static/styles.css` returns 200 CSS (include stable marker `/* platform-404 */`)
- [x] TDD: `PORT` env wiring (default `3000`, valid override, defined behavior for invalid)
- [x] TDD: entrypoint aligned (`bun run dev` boots server; README updated; no side effects on import)

## Target Structure (only as needed by tasks)
- `src/main.ts` (composition root)
- `src/api/health.ts`, `src/api/router.ts`
- `src/ui/templates/page.ts`, `src/ui/routes.ts`, `src/ui/static/styles.css`
- Create dirs when first needed: `src/services/`, `src/primitives/`

## Working State Definition
- `bun run dev` boots server
- `/api/health`, `/`, `/static/styles.css` all respond
- `bun run validate` green

## Discoveries
- Env var tests need try/finally cleanup pattern (save original, restore after test) to prevent cross-test pollution

## Bugs
(none reported yet)
