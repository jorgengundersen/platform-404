# Ingestion Vertical Slice: SourceDb -> DashboardDb -> Overview Stats (Ralph Loop / TDD)

Goal: first real end-to-end slice: read OpenCode SQLite (read-only) -> ingest into owned dashboard SQLite -> serve one stats endpoint.

## Non-goals (explicitly NOT now)
- No UI beyond placeholder HTML
- No message/part ingestion yet (sessions only)
- No periodic sync loop yet (single-shot ingestion on startup)
- No docker/compose yet

## Task Queue (pick top-most incomplete)

- [ ] TDD: `SourceDb` opens `OPENCODE_DB_PATH` read-only + `PRAGMA query_only=ON`
- [ ] TDD: `SourceDb.listSessionsUpdatedSince(sinceMs)` returns stable, typed rows (at least `id`, `project_id`, `title`, `time_updated`)
- [ ] TDD: `DashboardDb` opens `DASHBOARD_DB_PATH` (default `/data/dashboard.db`) and runs migrations
- [ ] TDD: `DashboardDb` schema v1: `ingestion_cursor`, `sessions` (subset columns ok), unique PKs
- [ ] TDD: `IngestionService.ingestOnce` copies new/updated sessions using cursor watermark; idempotent upsert
- [ ] TDD: `GET /api/stats/overview` returns `{ data: { totalSessions: number } }` backed by `dashboard.db`
- [ ] TDD: `GET /api/health` includes `{ data: { status: "ok", lastSync: number | null } }`

## Target Structure (only as needed by tasks)
- `src/services/source-db.ts`
- `src/services/dashboard-db.ts`
- `src/services/ingestion.ts`
- `src/api/stats.ts`
- `src/api/health.ts` (extend)
- `src/main.ts` (wire: config -> migrate -> ingestOnce -> serve)
- `test/services/*.test.ts` (integration via temp sqlite files)

## Working State Definition
- Boot fails fast if `OPENCODE_DB_PATH` missing/invalid (already)
- Boot succeeds with a real `opencode.db` path and creates/updates `dashboard.db`
- `/api/stats/overview` returns non-zero `totalSessions` after ingestion
- `bun run validate` green

## Discoveries
- (none yet)

## Bugs
(none reported yet)
