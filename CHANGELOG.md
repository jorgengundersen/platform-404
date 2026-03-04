# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/jorgengundersen/platform-404/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/jorgengundersen/platform-404/releases/tag/v0.1.0
