# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-03-12

### Added

- Dashboard V2: hero KPI row with period-over-period deltas, trend charts (cost + sessions/day), cost driver breakdown (top projects + models by spend), anomaly detection (cost spikes, model spikes), expensive session highlights
- Range-based stats: KPI summary, trend series with gap fill, project/model cost share, anomaly feeds — all supporting `7d`/`30d`/`90d` range with optional `compare` toggle
- Dashboard range/compare query param decoder (`@effect/schema`)
- Detail pages: `/sessions` (paginated, project-filterable), `/projects`, `/models`, `/daily/:date`
- Global nav bar with active link highlighting (`aria-current`)
- Catch-all 404 handler returning styled HTML page
- Favicon serving to eliminate load-time 404
- Linked stat cards and quick-glance sections on front page
- CSS for pagination, linked stat cards, quick-section layout
- Git SHA project name truncation (8 chars) for readability
- Playwright smoke test for core UI routes
- Specs: Claude Code integration (OTel-based ingestion), source abstraction (harness-agnostic adapter pattern)

### Fixed

- Dev/test data isolation: `DASHBOARD_DB_PATH` required (no fallback), `make dev` wipes both DBs fresh every run
- Preserve `time_created` from source sessions during ingestion
- Clamp out-of-bounds pagination page to valid range
- Align `getSessionsForDate` to filter by `time_updated` like `daily_stats`
- Default `GET /api/stats/daily` to last 30 days when no params given
- Show truncated `projectId` when `project_name` is NULL
- Back-link navigation on session-detail and project-filtered sessions pages
- Sticky table header accounts for nav height
- Consistent layout padding across sessions-list, projects, models pages
- Dashboard header uses dedicated CSS class instead of session-header
- Stat card spacing below overview cards
- Date Range stat card font size to prevent overflow
- Dashboard KPI cards stack on mobile
- Playwright default to bundled chromium instead of chrome channel

## [0.1.0] - 2026-03-04

### Added

- Project scaffolding: bun project init, TypeScript strict mode, path aliases (`@/`), biome formatter/linter, lefthook pre-commit hooks (format:check, lint, typecheck, test)
- Architecture: Effect-based service layer (`DashboardDb`, `StatsService`, `IngestionService`, `SourceDb`)
- Ingestion pipeline: reads opencode SQLite source DB, ingests sessions/messages/parts into local dashboard DB, periodic background sync
- API routes: `GET /api/health`, `GET /api/stats/overview`, `GET /api/stats/daily`, `GET /api/stats/models`, `GET /api/stats/projects`, `GET /api/sessions`, `GET /api/sessions/:id`
- UI: server-rendered HTML dashboard (dark theme, CSS design tokens), session detail page, static CSS handler
- Docker: `Dockerfile` + `docker-compose.yml` for containerised deployment
- Specs: architecture, coding standards, testing standards, git conventions, dashboard navigation, dashboard detail pages

### Fixed

- `OPENCODE_DB_PATH` corrected to match devenv-data volume structure
- Docker entrypoint changed from `src/main.ts` to `index.ts`
- `tsconfig.json` copied into Docker image for `@/` path alias resolution
- Dev seed script: add missing message and part tables

[Unreleased]: https://github.com/jorgengundersen/platform-404/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/jorgengundersen/platform-404/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/jorgengundersen/platform-404/releases/tag/v0.1.0
