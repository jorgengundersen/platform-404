# Architecture

## Overview

Platform-404 is a personal dashboard that tracks OpenCode usage across devenv sessions. It reads from the OpenCode SQLite database (read-only, WAL-safe) and maintains its own persistent database for historical data.

Runs as a Docker container, accessible from localhost.

## Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun |
| Language | TypeScript (strict) |
| Core framework | Effect |
| HTTP server | @effect/platform-bun |
| SQLite | @effect/sql-sqlite-bun (wraps bun:sqlite) |
| Styling | Plain CSS |
| Testing | bun:test |

### Dependencies

```
effect
@effect/platform
@effect/platform-bun
@effect/sql
@effect/sql-sqlite-bun
@effect/schema
```

No other runtime dependencies. Add dependencies only when the alternative is re-implementing something complex and error-prone.

## Data Flow

```
opencode.db (read-only) --> Ingestion Service --> dashboard.db (read-write) --> API --> UI
```

1. **Ingestion**: Reads new data from `opencode.db`, transforms it, writes to `dashboard.db`
2. **API**: Queries `dashboard.db` and serves JSON
3. **UI**: Server-rendered HTML + plain CSS, minimal client JS for interactivity

## OpenCode Database (Source - Read Only)

Location: `$XDG_DATA_HOME/opencode/opencode.db` (`/home/devuser/.local/share/opencode/opencode.db`)

### Schema (from OpenCode source)

**`project`**
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| worktree | TEXT | absolute path |
| name | TEXT | |
| time_created | INTEGER | unix ms |
| time_updated | INTEGER | unix ms |

**`session`**
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | e.g. `ses_...` |
| project_id | TEXT FK | references project.id |
| parent_id | TEXT | for branched sessions |
| slug | TEXT | |
| title | TEXT | |
| version | TEXT | opencode version |
| summary_additions | INTEGER | |
| summary_deletions | INTEGER | |
| summary_files | INTEGER | |
| time_created | INTEGER | unix ms |
| time_updated | INTEGER | unix ms |

**`message`**
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| session_id | TEXT FK | references session.id |
| data | TEXT (JSON) | see below |
| time_created | INTEGER | unix ms |
| time_updated | INTEGER | unix ms |

The `data` JSON column is a discriminated union on `role`:

- **`role: "user"`**: `{ agent, model: { providerID, modelID }, system?, tools? }`
- **`role: "assistant"`**: `{ modelID, providerID, cost, tokens: { input, output, reasoning, cache: { read, write } }, finish? }`

**`part`**
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| message_id | TEXT FK | references message.id |
| session_id | TEXT | |
| data | TEXT (JSON) | discriminated union on `type` |
| time_created | INTEGER | unix ms |
| time_updated | INTEGER | unix ms |

Key part types in `data`:
- `type: "text"` - text content
- `type: "tool"` - tool call with `{ tool, state, callID }`
- `type: "step-finish"` - `{ cost, tokens: { input, output, reasoning, cache: { read, write } } }`

### Read-Only Access Rules

- Open with `readonly: true` flag
- Set `PRAGMA query_only = ON` as safety net
- Never write, never run migrations, never vacuum
- Use `PRAGMA journal_mode` to verify WAL is active (do not set it)
- Keep connections short-lived or use connection pooling with low limits
- Handle `SQLITE_BUSY` gracefully (the writer is OpenCode)

## Dashboard Database (Owned - Read/Write)

Location: `/data/dashboard.db` (mounted from `platform-404-data` Docker volume)

This database stores:
- Ingested and denormalized OpenCode data (survives devenv volume deletion)
- Dashboard-specific state (bookmarks, tags, settings)
- Precomputed aggregations for fast queries

### Schema Design Principles

- Denormalize for read performance (this is an analytics workload)
- Store raw ingested records alongside aggregates
- Track ingestion watermarks to know what's already been synced
- All timestamps in unix milliseconds (matching OpenCode convention)

### Core Tables

**`ingestion_cursor`** - tracks sync progress
| Column | Type | Notes |
|--------|------|-------|
| source | TEXT PK | e.g. `opencode_session`, `opencode_message` |
| last_time_updated | INTEGER | highest time_updated seen |
| last_synced_at | INTEGER | when sync ran |

**`sessions`** - denormalized session data
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | from opencode |
| project_id | TEXT | |
| project_name | TEXT | denormalized |
| title | TEXT | |
| version | TEXT | opencode version |
| summary_additions | INTEGER | |
| summary_deletions | INTEGER | |
| summary_files | INTEGER | |
| message_count | INTEGER | computed |
| total_cost | REAL | computed |
| total_tokens_input | INTEGER | computed |
| total_tokens_output | INTEGER | computed |
| total_tokens_reasoning | INTEGER | computed |
| total_cache_read | INTEGER | computed |
| total_cache_write | INTEGER | computed |
| time_created | INTEGER | |
| time_updated | INTEGER | |
| time_ingested | INTEGER | |

**`messages`** - denormalized message data
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | from opencode |
| session_id | TEXT | |
| role | TEXT | user or assistant |
| provider_id | TEXT | extracted from data JSON |
| model_id | TEXT | extracted from data JSON |
| agent | TEXT | |
| cost | REAL | assistant messages only |
| tokens_input | INTEGER | |
| tokens_output | INTEGER | |
| tokens_reasoning | INTEGER | |
| cache_read | INTEGER | |
| cache_write | INTEGER | |
| time_created | INTEGER | |
| time_ingested | INTEGER | |

**`daily_stats`** - precomputed daily aggregates
| Column | Type | Notes |
|--------|------|-------|
| date | TEXT PK | YYYY-MM-DD |
| session_count | INTEGER | |
| message_count | INTEGER | |
| total_cost | REAL | |
| total_tokens_input | INTEGER | |
| total_tokens_output | INTEGER | |
| total_tokens_reasoning | INTEGER | |
| total_cache_read | INTEGER | |
| total_cache_write | INTEGER | |
| time_updated | INTEGER | |

## Application Layers

```
src/
  primitives/       # Layer 0 - Pure, composable building blocks
  services/         # Layer 1 - Business logic (Effect services + layers)
  api/              # Layer 2 - HTTP routes
  ui/               # Layer 3 - HTML templates + CSS
  main.ts           # Composition root
```

### Layer 0: Primitives

Pure functions and simple data transformers. No Effect, no dependencies, no side effects.

Examples:
- `primitives/time.ts` - timestamp formatting, date ranges, bucketing
- `primitives/tokens.ts` - token math (totals, averages, cost calculations)
- `primitives/json.ts` - safe JSON parsing for opencode data columns
- `primitives/stats.ts` - statistical functions (sum, avg, percentiles)
- `primitives/sql.ts` - query builder helpers, parameter sanitization

Rules:
- Pure functions only (input -> output)
- No imports from `effect` (exception: `@effect/schema` for data validation)
- No I/O, no state, no services
- Fully unit testable with simple assertions

### Layer 1: Services

Effect services that compose primitives with I/O. Each service is a `Context.Tag` + `Layer`.

**`SourceDb`** - read-only connection to opencode.db
- Opens with readonly flag
- Queries sessions, messages, parts
- Returns raw rows

**`DashboardDb`** - read-write connection to dashboard.db
- Runs migrations on startup
- Writes ingested data
- Queries for API responses

**`IngestionService`** - syncs data from source to dashboard
- Checks ingestion cursors
- Reads new/updated records from source
- Transforms using primitives
- Writes to dashboard db
- Runs on startup + periodic interval (configurable, default 30s)

**`StatsService`** - computes analytics
- Queries dashboard db
- Uses primitives for calculations
- Returns typed result objects

### Layer 2: API

HTTP routes using `@effect/platform` HttpRouter. JSON API.

```
GET /api/stats/overview          # totals, averages
GET /api/stats/daily             # daily breakdown, supports date range query params
GET /api/sessions                # paginated session list
GET /api/sessions/:id            # session detail with messages
GET /api/stats/models            # per-model breakdown
GET /api/stats/projects          # per-project breakdown
GET /api/health                  # health check + last sync time
```

### Layer 3: UI

Server-rendered HTML served from the same HTTP server.

```
GET /                            # dashboard page (served as HTML)
GET /static/*                    # CSS, client JS (minimal)
```

- HTML generated server-side (template strings or simple template engine)
- Plain CSS, no preprocessors, no CSS-in-JS
- Minimal client JS: only for interactive filtering/date pickers
- No SPA framework, no build step for frontend

## Docker

### Container

```dockerfile
FROM oven/bun:1-slim
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY src/ src/
EXPOSE 3000
CMD ["bun", "run", "src/main.ts"]
```

### Volumes

| Volume | Mount | Purpose |
|--------|-------|---------|
| `devenv-data` | `/mnt/devenv-data` (read-only) | Access to opencode.db |
| `platform-404-data` | `/data` | Dashboard's own database |

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP server port |
| `OPENCODE_DB_PATH` | `/mnt/devenv-data/opencode/opencode.db` | Path to opencode database |
| `DASHBOARD_DB_PATH` | `/data/dashboard.db` | Path to dashboard database |
| `SYNC_INTERVAL_MS` | `30000` | Ingestion sync interval |

## Security

- OpenCode DB opened read-only + `PRAGMA query_only = ON`
- No authentication (localhost only, personal use)
- No external network calls
- Docker volume mounts control filesystem access
- Input validation on all API query parameters via `@effect/schema`
- SQLite parameterized queries only (no string interpolation)

## Error Handling

- Effect's structured error handling throughout services
- Source DB unavailable: dashboard continues serving cached data, logs warning
- Ingestion failures: logged, retried on next interval, cursor not advanced
- API errors: proper HTTP status codes + JSON error bodies
