# OpenCode Schema Alignment: Real Session+Project Ingestion (Ralph Loop / TDD)

Goal: align to real OpenCode SQLite schema (`project`/`session`) and ingest sessions+projects (correct IDs, names) into `dashboard.db`.

## Non-goals (explicitly NOT now)
- No message/part ingestion
- No token/cost aggregation, `daily_stats`, or model/project breakdown stats
- No periodic sync loop (single-shot ok)
- No Effect `Layer`/`HttpRouter` refactor
- No UI work beyond existing placeholder

## Task Queue (pick top-most incomplete)

- [x] TDD: `SourceDb.listSessionsUpdatedSince` queries OpenCode `session` table (not `sessions`) and returns TEXT ids (`id`, `project_id`, `title`, `time_updated`)
- [x] TDD: `SourceDb.listProjectsByIds(ids)` returns `{ id, name }` for referenced projects
- [x] TDD: `DashboardDb` schema v2: sessions uses TEXT ids; add/ensure `project_name` column (migration safe for existing db)
- [x] TDD: `IngestionService.ingestOnce` upserts sessions with `project_name` populated via project lookup
- [x] TDD: `IngestionService.ingestOnce` cursor watermark advances correctly when multiple sessions share same `time_updated`
- [ ] TDD: `/api/stats/overview` still returns correct `totalSessions` after schema alignment + ingestion

## Target Structure (only as needed by tasks)
- `src/services/source-db.ts`
- `src/services/dashboard-db.ts`
- `src/services/ingestion.ts`
- `src/api/stats.ts`
- `test/services/source-db.test.ts`
- `test/services/dashboard-db.test.ts`
- `test/services/ingestion.test.ts`
- `test/api/stats.test.ts`

## Working State Definition
- Boot with real `OPENCODE_DB_PATH` ingests OpenCode `session` rows (TEXT ids) into `dashboard.db`
- Ingested sessions include correct `project_name`
- Ingestion remains idempotent; cursor prevents re-copying
- `bun run validate` green

## Discoveries
- Assumption: DashboardDb sessions schema already v2 (TEXT id, project_name column, migration safe).
- Cursor boundary now strict `time_updated > cursor`; initial cursor `-1` to include 0 timestamps.

## Bugs
- (none yet)
