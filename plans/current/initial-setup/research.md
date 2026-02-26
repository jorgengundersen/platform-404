# Research & Gap Analysis: Initial Setup

## Current State

The repo contains **specs only** — zero implementation. 4 commits on `main`, all documentation.

### What Exists

| Item | Status |
|------|--------|
| `specs/architecture.md` | Complete — stack, data flow, DB schemas, layers, Docker, env vars, security, error handling |
| `specs/coding-standard.md` | Complete — TS config, naming, file org, Effect patterns, SQL rules, API format, UI/CSS rules |
| `specs/testing-standard.md` | Complete — trophy model, bun:test, unit/integration/API test patterns, CI config |
| `.gitignore` | Present (standard Node/JS) |
| `AGENTS.md` | Present |
| `LICENSE` | GPLv3 |
| `initial-prompt.md` | Project brief |

### What's Missing (Everything Else)

Every implementation artifact needs to be created from scratch.

---

## Gap Analysis

### 1. Project Scaffolding

| Required | Spec Source | Notes |
|----------|------------|-------|
| `package.json` | architecture.md (deps), testing-standard.md (scripts) | Deps: `effect`, `@effect/platform`, `@effect/platform-bun`, `@effect/sql`, `@effect/sql-sqlite-bun`, `@effect/schema`. Scripts: `test`, `test:watch`, `typecheck`. |
| `tsconfig.json` | coding-standard.md (compiler config) | Strict mode, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `paths: { "@/*": ["./src/*"] }`, `types: ["bun-types"]` |
| `bun install` | — | Generate `bun.lock` and `node_modules/` |

### 2. Source Directory Structure

Per `coding-standard.md` project structure:

```
src/
  primitives/
    schemas/          # @effect/schema definitions
    time.ts
    tokens.ts
    json.ts
    stats.ts
  services/
    source-db.ts
    dashboard-db.ts
    ingestion.ts
    stats.ts
  api/
    stats.ts
    sessions.ts
    health.ts
    router.ts
  ui/
    templates/
      page.ts
      dashboard.ts
      session-detail.ts
    static/
      styles.css
  main.ts
```

**None of this exists.**

### 3. Test Directory Structure

Per `testing-standard.md`:

```
test/
  primitives/         # unit tests (bulk of tests)
    tokens.test.ts
    time.test.ts
    json.test.ts
  services/           # integration tests
    ingestion.test.ts
    stats.test.ts
```

**None of this exists.**

### 4. Docker

| Required | Spec Source | Notes |
|----------|------------|-------|
| `Dockerfile` | architecture.md | `oven/bun:1-slim`, frozen lockfile, production install, expose 3000 |
| `docker-compose.yml` | architecture.md | Two volumes: `devenv-data` (ro, opencode.db), `platform-404-data` (rw, dashboard.db). Env vars: `PORT`, `OPENCODE_DB_PATH`, `DASHBOARD_DB_PATH`, `SYNC_INTERVAL_MS` |

### 5. CI

| Required | Spec Source | Notes |
|----------|------------|-------|
| `.github/workflows/test.yml` | testing-standard.md | `oven-sh/setup-bun@v2`, `bun install --frozen-lockfile`, `bun test`, `bun run typecheck` |

### 6. Layer 0 — Primitives

Foundational pure functions. No Effect dependency (except `@effect/schema` for schemas).

| File | Purpose | Key Functions/Exports |
|------|---------|----------------------|
| `primitives/schemas/*` | Shared type vocabulary | `TokenRecord`, message data schemas, API param schemas |
| `primitives/time.ts` | Timestamp formatting, date ranges, bucketing | `formatDate`, `bucketByDay`, date range helpers |
| `primitives/tokens.ts` | Token math | `sumTokens`, `avgTokensPerMessage` |
| `primitives/json.ts` | Safe JSON parsing for opencode data columns | `safeParseJson` |
| `primitives/stats.ts` | Statistical functions | sum, avg, percentiles |
| `primitives/sql.ts` | Query builder helpers, param sanitization | (referenced in architecture.md) |

### 7. Layer 1 — Services

Effect services with `Context.Tag` + `Layer` pattern.

| Service | Purpose | Dependencies | Error Type |
|---------|---------|-------------|------------|
| `SourceDb` | Read-only connection to opencode.db | bun:sqlite | `SourceDbError` |
| `DashboardDb` | Read-write connection to dashboard.db, runs migrations | bun:sqlite | `DashboardDbError` |
| `IngestionService` | Sync opencode -> dashboard, cursor-based | `SourceDb`, `DashboardDb`, primitives | `IngestionError` |
| `StatsService` | Analytics queries against dashboard.db | `DashboardDb`, primitives | `StatsError` |

Each needs a `*Live` layer and a `*Test` layer (in-memory SQLite for tests).

### 8. Layer 2 — API

HTTP routes via `@effect/platform` HttpRouter.

| Endpoint | Purpose |
|----------|---------|
| `GET /api/stats/overview` | Totals, averages |
| `GET /api/stats/daily` | Daily breakdown, date range params |
| `GET /api/sessions` | Paginated session list |
| `GET /api/sessions/:id` | Session detail + messages |
| `GET /api/stats/models` | Per-model breakdown |
| `GET /api/stats/projects` | Per-project breakdown |
| `GET /api/health` | Health check + last sync time |

Response format: `{ "data": ... }` or `{ "error": { "code": "...", "message": "..." } }`

### 9. Layer 3 — UI

| File | Purpose |
|------|---------|
| `ui/templates/page.ts` | Base HTML wrapper |
| `ui/templates/dashboard.ts` | Main dashboard view |
| `ui/templates/session-detail.ts` | Session detail view |
| `ui/static/styles.css` | Single CSS file, custom properties, dark theme |

Server-rendered HTML via template strings. Minimal client JS. No SPA framework.

### 10. Composition Root

`src/main.ts` — wires all layers together, starts HTTP server on configured port.

---

## Implementation Order (Suggested)

The layered architecture naturally dictates build order — lower layers first.

### Phase 1: Scaffolding
- `package.json` with all deps + scripts
- `tsconfig.json` with strict config
- `bun install`
- Directory structure (`src/`, `test/`)

### Phase 2: Layer 0 — Primitives + Tests
- Schema definitions (`primitives/schemas/`)
- Pure functions (`time.ts`, `tokens.ts`, `json.ts`, `stats.ts`)
- Unit tests for each primitive
- Verify: `bun test` passes

### Phase 3: Layer 1 — Services
- `DashboardDb` service + migrations (tables: `ingestion_cursor`, `sessions`, `messages`, `daily_stats`)
- `SourceDb` service (read-only opencode.db access)
- `IngestionService` (cursor-based sync)
- `StatsService` (analytics queries)
- `*Test` layer variants (in-memory SQLite)
- Integration tests
- Verify: `bun test` passes

### Phase 4: Layer 2 — API
- Route handlers for all endpoints
- Router composition
- Input validation with `@effect/schema`
- API tests (light)
- Verify: `bun test` passes

### Phase 5: Layer 3 — UI
- HTML templates
- CSS (dark theme, custom properties)
- Static file serving
- Wire to HTTP server

### Phase 6: Composition + Docker
- `main.ts` composition root
- `Dockerfile`
- `docker-compose.yml`
- Verify: container builds and runs

### Phase 7: CI
- `.github/workflows/test.yml`

---

## Key Constraints (From Specs)

- **No `any`** — use `unknown` + narrowing or schema decode
- **No `null`** — use `Option` or `undefined`
- **No classes** except Effect `Context.Tag`
- **No enums** — string literal unions
- **No barrel files** — import directly
- **No mocking** in unit tests (primitives are pure)
- **Real SQLite** (in-memory) for integration tests
- **Parameterized SQL only** — no string interpolation
- **Max ~200 lines per file**, split at 300
- **Path aliases**: `@/primitives/...` not relative paths
- **Conventional commits**: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`
- **OpenCode DB is read-only** — `readonly: true` flag + `PRAGMA query_only = ON`

## Risks / Open Questions

1. **Effect + @effect/platform-bun version compatibility** — need to verify compatible versions of all Effect ecosystem packages work together with current Bun version
2. **@effect/sql-sqlite-bun API surface** — need to confirm the exact API for read-only connections, WAL verification, and `PRAGMA query_only`
3. **OpenCode DB availability** — in dev/test environments, the opencode.db may not exist at the expected path; need graceful handling from day one
4. **Schema evolution** — no migration strategy defined for the dashboard DB beyond "runs migrations on startup"; need to decide on a migration approach (versioned SQL files vs programmatic)
5. **`primitives/sql.ts`** — referenced in architecture.md but unclear what "query builder helpers" means given that `@effect/sql` tagged templates handle parameterization; may be unnecessary
