# Source Abstraction

Spec for decoupling Platform-404 from any single coding harness. Prerequisite for Claude Code integration and future harnesses (Cursor, Aider, Windsurf, etc).

## Status

- Must be completed before Claude Code integration.
- Supersedes the source-specific schema approach in `specs/claude-code-integration.md` (that spec's DB schema section should be revised after this).

## Problem

The codebase is implicitly single-source. Although the downstream layers (stats, API, UI) are already generic, the ingestion boundary has structural coupling to OpenCode that would force us to duplicate code for every new harness.

### Coupling Inventory

**Structural coupling (must change)**:

| File | Coupling |
|------|----------|
| `src/primitives/schemas/message-data.ts` | Decodes OpenCode's exact `message.data` JSON blob (`AssistantMessageData`, `UserMessageData`). Field names `modelID`, `providerID`, nested `model: { providerID, modelID }`, `agent`, `tools` are OpenCode's internal wire format. |
| `src/primitives/schemas/part-data.ts` | Decodes OpenCode's `part.data` JSON blob. The entire "parts" concept (`step-finish`, `callID`) is OpenCode-specific. No other harness has this entity. |
| `src/services/source-db.ts` | 100% OpenCode adapter. SQL queries reference OpenCode's tables (`session`, `project`, `message`, `part`). Row types mirror OpenCode's columns 1:1. The `SourceDb` service interface exposes `listPartsForMessages` which only makes sense for OpenCode. |
| `src/services/ingestion.ts` | Monolithic pipeline. Decodes OpenCode JSON blobs at lines 142-210 and 278-304. Three-entity model (sessions -> messages -> parts) is baked in. Cursor labels hardcoded to `'opencode_session'`/`'opencode_message'`. |
| `src/config.ts` | Single `opencodeDbPath` field. Config type only has room for one source. |

**Naming coupling (trivial to fix)**:

| Location | Name |
|----------|------|
| Env var `OPENCODE_DB_PATH` | Rename or keep for backward compat |
| Config field `opencodeDbPath` | Rename |
| Cursor values `'opencode_session'`, `'opencode_message'` | Rename |
| `scripts/seed-dev-opencode-db.ts` | Rename |
| Health API queries cursor by `'opencode_session'` | Parameterize |

**Already generic (no changes needed)**:

| Layer | Why |
|-------|-----|
| `dashboard-db.ts` schema | Uses snake_case, generic column names. `sessions`, `messages`, `daily_stats` are harness-agnostic. |
| `stats.ts` | Queries only dashboard tables. Zero source-specific references. |
| `api/*.ts` (except health.ts cursor lookup) | Generic domain terms. |
| `ui/templates/*.ts` | Zero OpenCode references. |
| `primitives/tokens.ts`, `time.ts`, `stats.ts`, `json.ts`, `math.ts` | Pure utility functions. |
| `primitives/schemas/session-summary.ts`, `api-params.ts` | Dashboard domain types. |

## Goals

- Any new harness requires ONLY: (1) a source adapter, (2) harness-specific schemas in primitives, (3) a config entry. Zero changes to dashboard DB, stats, API, or UI.
- Existing OpenCode ingestion behavior identical after refactor.
- `source` column on all dashboard tables for filtering/grouping.
- Primitives layer wraps/abstracts all harness-specific parsing. No harness-specific logic above Layer 0.

## Non-goals

- No multi-tenant / multi-user.
- No live-reloading of source configs.
- No abstract base class / OOP hierarchy. Use Effect patterns.

## Architecture Changes

### 1. Normalized Batch Record (the adapter contract)

Define a `NormalizedBatch` type that every source adapter must produce. This is the seam between "read from harness" and "write to dashboard."

```
src/primitives/schemas/normalized-batch.ts
```

```ts
type NormalizedSession = {
  id: string;
  source: string;           // "opencode" | "claude_code" | "cursor" | ...
  projectId: string | null;
  projectName: string | null;
  title: string | null;
  messageCount: number;
  totalCost: number;
  totalTokensInput: number;
  totalTokensOutput: number;
  totalTokensReasoning: number;
  totalCacheRead: number;
  totalCacheWrite: number;
  timeCreated: number;       // unix ms
  timeUpdated: number;       // unix ms
  // harness-specific metadata (opaque JSON, stored but not indexed)
  metadata: Record<string, unknown> | null;
};

type NormalizedMessage = {
  id: string;
  sessionId: string;
  source: string;
  role: string;              // "user" | "assistant" | "system" | "unknown"
  providerId: string | null;
  modelId: string | null;
  cost: number | null;
  tokensInput: number;
  tokensOutput: number;
  tokensReasoning: number;
  cacheRead: number;
  cacheWrite: number;
  timeCreated: number;
  // harness-specific metadata (opaque JSON)
  metadata: Record<string, unknown> | null;
};

type NormalizedBatch = {
  source: string;
  sessions: NormalizedSession[];
  messages: NormalizedMessage[];
  cursorKey: string;          // e.g. "opencode:session"
  cursorValue: number;        // new high-water mark
};
```

Key design decisions:
- `source` is a string discriminant on every record. Allows filtering/grouping at query time.
- `metadata` is an opaque JSON column for harness-specific extras (OpenCode's `agent`, `version`, `summary_*`; Claude Code's `active_time`, `lines_added`, `terminal_type`). Stored as TEXT, queryable via SQLite `json_extract()` when needed but not in the core schema.
- `tokensReasoning` stays. It's zero for harnesses that don't track reasoning tokens. Better than omitting it and losing data for those that do.
- `cacheRead`/`cacheWrite` stay. Same rationale. Claude Code calls it `cacheCreation` instead of `cacheWrite` -- the adapter normalizes this at the boundary.

### 2. Source Adapter Interface

```
src/services/source-adapter.ts
```

```ts
type SourceAdapter = {
  readonly source: string;
  readonly fetchBatch: Effect.Effect<NormalizedBatch | null, SourceAdapterError>;
};
```

- `fetchBatch` reads the cursor from dashboard.db, queries the external source for changes, normalizes, returns a `NormalizedBatch`. Returns `null` if no new data.
- Each adapter is an Effect service (its own `Context.Tag` + `Layer`).
- The adapter owns cursor key naming and cursor semantics (timestamp, sequence number, etc).

### 3. Relocate OpenCode-Specific Code

Current location -> New location:

| Current | New | Rationale |
|---------|-----|-----------|
| `src/primitives/schemas/message-data.ts` | `src/adapters/opencode/schemas/message-data.ts` | OpenCode wire format. Not a platform primitive. |
| `src/primitives/schemas/part-data.ts` | `src/adapters/opencode/schemas/part-data.ts` | OpenCode-only concept. |
| `src/services/source-db.ts` | `src/adapters/opencode/source-db.ts` | OpenCode SQLite reader. |
| OpenCode-specific decode logic in `src/services/ingestion.ts` (lines 38-40, 142-210, 278-304) | `src/adapters/opencode/adapter.ts` | Transformation from OpenCode rows to `NormalizedBatch`. |

New directory structure:

```
src/
  adapters/
    opencode/
      adapter.ts          # implements SourceAdapter, reads OC DB, produces NormalizedBatch
      source-db.ts         # moved from services/source-db.ts (unchanged logic)
      schemas/
        message-data.ts    # moved from primitives/schemas/ (unchanged)
        part-data.ts       # moved from primitives/schemas/ (unchanged)
    claude-code/
      adapter.ts          # implements SourceAdapter, receives OTel, produces NormalizedBatch
      otel-receiver.ts    # OTLP HTTP endpoint + buffer
      schemas/
        otel-metrics.ts   # OTLP payload schemas
        otel-logs.ts
```

### 4. Generic Ingestion Service

Refactor `src/services/ingestion.ts` to be source-agnostic:

```ts
// src/services/ingestion.ts (after refactor)

const ingestOnce = (adapters: SourceAdapter[]) =>
  Effect.forEach(adapters, (adapter) =>
    Effect.gen(function* () {
      const batch = yield* adapter.fetchBatch;
      if (!batch) return;
      yield* writeBatch(batch); // generic: upserts sessions, messages, daily_stats
    }).pipe(
      Effect.catchAll((e) =>
        Effect.log(`[ingestion:${adapter.source}] error: ${e.reason}`)
      ),
    ),
    { concurrency: 1 }, // sequential to avoid write contention
  );
```

The `writeBatch` function:
- Upserts into `sessions` (with `source` column).
- Upserts into `messages` (with `source` column).
- Recomputes `daily_stats` for affected dates.
- Advances `ingestion_cursor` for the batch's `cursorKey`.

All the OpenCode-specific decoding (JSON blob parsing, step-finish part aggregation, three-entity merge) moves into `adapters/opencode/adapter.ts`. The generic ingestion service never sees raw OpenCode data.

### 5. Database Schema Changes

**`sessions` table** -- add `source` column:

```sql
ALTER TABLE sessions ADD COLUMN source TEXT DEFAULT 'opencode';
ALTER TABLE sessions ADD COLUMN metadata TEXT;  -- JSON blob
```

**`messages` table** -- add `source` column:

```sql
ALTER TABLE messages ADD COLUMN source TEXT DEFAULT 'opencode';
ALTER TABLE messages ADD COLUMN metadata TEXT;  -- JSON blob
```

**`daily_stats` table** -- add `source` column, change PK:

```sql
-- daily_stats becomes keyed by (date, source) instead of just (date)
-- Migration: rename old table, create new, copy with source='opencode', drop old.
CREATE TABLE daily_stats_v2 (
  date TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'opencode',
  session_count INTEGER,
  message_count INTEGER,
  total_cost REAL,
  total_tokens_input INTEGER,
  total_tokens_output INTEGER,
  total_tokens_reasoning INTEGER,
  total_cache_read INTEGER,
  total_cache_write INTEGER,
  time_updated INTEGER,
  PRIMARY KEY (date, source)
);
```

**`ingestion_cursor`** -- already extensible (source TEXT PK). Just use namespaced keys: `opencode:session`, `opencode:message`, `claude_code:otel`, etc. Existing `opencode_session` / `opencode_message` values get migrated.

### 6. Config Changes

```ts
// src/config.ts (after refactor)
type SourceConfig =
  | { type: "opencode"; dbPath: string }
  | { type: "claude_code"; otelPort?: number }  // or null if disabled
  // future: | { type: "cursor"; dbPath: string }

type Config = {
  readonly sources: SourceConfig[];
  readonly dashboardDbPath: string;
  readonly syncIntervalMs: number;
};
```

Backward compatibility: if `OPENCODE_DB_PATH` is set, add `{ type: "opencode", dbPath }` to sources. New env var `CLAUDE_CODE_OTEL=1` enables the Claude Code adapter. Future harnesses get their own env vars.

The config still fail-fasts if `DASHBOARD_DB_PATH` is missing. But source config is now optional -- the platform can start with zero sources (useful for development or if only the OTel receiver is active).

### 7. Composition Root Changes (`main.ts`)

```ts
function buildAdapters(config: Config): SourceAdapter[] {
  const adapters: SourceAdapter[] = [];
  for (const source of config.sources) {
    switch (source.type) {
      case "opencode":
        adapters.push(makeOpenCodeAdapter(source.dbPath));
        break;
      case "claude_code":
        adapters.push(makeClaudeCodeAdapter());
        break;
    }
  }
  return adapters;
}
```

Ingestion loop calls `ingestOnce(adapters)` on each tick. Each adapter independently manages its cursor and external connection.

## Statistics Harmonization

### What's already normalized

| Metric | OpenCode | Claude Code (OTel) | Dashboard Column | Harmonized? |
|--------|----------|-------------------|-----------------|-------------|
| Session ID | `ses_...` from DB | `session.id` OTel attr | `sessions.id` | Yes -- both are strings |
| Cost | `assistant.cost` (per-message, USD) | `claude_code.cost.usage` (per-API-call, USD) | `sessions.total_cost`, `messages.cost` | Yes -- sum to session total |
| Input tokens | `assistant.tokens.input` | `token.usage` where type=input | `total_tokens_input` | Yes |
| Output tokens | `assistant.tokens.output` | `token.usage` where type=output | `total_tokens_output` | Yes |
| Reasoning tokens | `assistant.tokens.reasoning` | Not exposed by Claude Code OTel | `total_tokens_reasoning` | Partial -- CC will be 0 |
| Cache read | `assistant.tokens.cache.read` | `token.usage` where type=cacheRead | `total_cache_read` | Yes |
| Cache write | `assistant.tokens.cache.write` | `token.usage` where type=cacheCreation | `total_cache_write` | Yes -- different name, same concept. Adapter normalizes. |
| Model ID | `assistant.modelID` (e.g. `claude-3-5-sonnet`) | `model` attr (e.g. `claude-sonnet-4-6`) | `messages.model_id` | Yes -- string passthrough. Different naming conventions but queryable. |
| Provider ID | `assistant.providerID` (e.g. `anthropic`) | Not in OTel metrics | `messages.provider_id` | Partial -- CC adapter hardcodes `"anthropic"` or leaves null |
| Project | `project.name` via FK | Not in OTel data | `sessions.project_id/name` | No -- CC has no project concept. NULL is fine. |
| Message count | Count of `message` rows | Count of `user_prompt` events (partial) | `sessions.message_count` | Partial -- CC OTel only logs user prompts, not assistant turns. See below. |
| Role | `data.role` ("user"/"assistant") | `api_request` = assistant turn, `user_prompt` = user turn | `messages.role` | Yes -- adapter maps event type to role |
| Lines changed | Not tracked | `lines_of_code.count` (added/removed) | `metadata` JSON | CC-only metric. Goes in metadata. |
| Active time | Not tracked | `active_time.total` (user/cli) | `metadata` JSON | CC-only metric. Goes in metadata. |
| Commits | Not tracked | `commit.count` | `metadata` JSON | CC-only metric. Goes in metadata. |
| Tool usage | `part.data` with type=tool | `tool_result` events | `metadata` or separate table | Different granularity. See below. |

### Key normalization rules

1. **Cache write vs cache creation**: OpenCode calls it `cache.write`, Claude Code calls it `cacheCreation`. Same concept. Adapters normalize to `cacheWrite` at the boundary.

2. **Reasoning tokens**: OpenCode tracks `tokens.reasoning`. Claude Code OTel does not expose reasoning tokens separately. The normalized column stays; CC sessions will have 0. If CC adds reasoning token tracking later, the adapter adds it without schema changes.

3. **Message count**: OpenCode has explicit message rows. Claude Code OTel has `user_prompt` events and `api_request` events. The CC adapter can count `api_request` events as assistant messages and `user_prompt` events as user messages. Not 1:1 equivalent (one user prompt may trigger multiple API requests), but close enough for analytics. The adapter should count unique `prompt.id` values as "turns" rather than raw event count.

4. **Provider ID**: OpenCode stores `providerID` per message. Claude Code OTel does not include provider info (it's always Anthropic unless using Bedrock/Vertex). CC adapter sets `provider_id = "anthropic"` as default, or infers from model name patterns.

5. **Harness-specific metrics**: Lines of code, active time, commits, PRs, tool decisions -- these are Claude Code-only. They go in the `metadata` JSON column, not as top-level columns. If we later find OpenCode exposes similar data (or a future harness does), we can promote a metadata field to a real column via migration.

6. **Session boundaries**: OpenCode sessions have explicit `time_created`/`time_updated` timestamps. Claude Code sessions are identified by the `session.id` OTel attribute, with `time_first_seen`/`time_last_seen` inferred from metric timestamps. The normalized schema uses `time_created` and `time_updated`; the CC adapter maps first_seen -> created, last_seen -> updated.

### Stats queries that need changes

The `StatsService` queries `dashboard-db` tables, which are already generic. After adding the `source` column:

| Query | Change Needed |
|-------|---------------|
| Overview totals | Add optional `WHERE source = ?` filter. Default: all sources combined. |
| Daily stats | Group by `(date, source)` or aggregate across sources. |
| KPIs with period comparison | Works as-is if daily_stats has source dimension. |
| Model breakdown | No change -- `GROUP BY provider_id, model_id` already works across sources. |
| Project breakdown | No change -- CC sessions have NULL project, excluded from project grouping. |
| Session list | Add `source` to SELECT and optional WHERE filter. |
| Anomaly detection | Works on daily totals. May want per-source anomalies. |

## Token Record Schema

`src/primitives/schemas/token-record.ts` currently defines:

```ts
{ input, output, reasoning, cache: { read, write } }
```

This nested `cache: { read, write }` mirrors OpenCode's JSON format. Flatten it for the normalized domain type:

```ts
// src/primitives/schemas/token-record.ts (after refactor)
type TokenRecord = {
  input: number;
  output: number;
  reasoning: number;
  cacheRead: number;
  cacheWrite: number;
};
```

- Flat structure. No nested `cache` object.
- `cacheWrite` absorbs both OpenCode's `cache.write` and Claude Code's `cacheCreation`.
- The OpenCode adapter flattens the nested structure. The Claude Code adapter maps `cacheCreation` -> `cacheWrite`.
- `sumTokens()` and other primitives updated to use flat fields.

This is a breaking change to the internal type. All consumers of `TokenRecord` update (ingestion, templates, tests). But it's the right time to do it -- before adding a second source.

## Implementation Plan

- [ ] Define `NormalizedBatch`, `NormalizedSession`, `NormalizedMessage` schemas
- [ ] Define `SourceAdapter` interface
- [ ] Flatten `TokenRecord` (remove nested `cache` object)
- [ ] Update `sumTokens()`, `avgTokensPerMessage()` for flat `TokenRecord`
- [ ] Add `source TEXT` + `metadata TEXT` columns to `sessions`, `messages` tables (migration)
- [ ] Change `daily_stats` PK to `(date, source)` (migration)
- [ ] Migrate `ingestion_cursor` keys: `opencode_session` -> `opencode:session`, etc
- [ ] Create `src/adapters/opencode/` directory
- [ ] Move `source-db.ts` -> `adapters/opencode/source-db.ts`
- [ ] Move `message-data.ts`, `part-data.ts` -> `adapters/opencode/schemas/`
- [ ] Extract OpenCode decode logic from `ingestion.ts` into `adapters/opencode/adapter.ts`
- [ ] Refactor `ingestion.ts` to accept `SourceAdapter[]` and call `writeBatch(NormalizedBatch)`
- [ ] Refactor `config.ts` to multi-source `SourceConfig[]`
- [ ] Refactor `main.ts` to build adapter list from config
- [ ] Update `StatsService` queries for `source` column (filter + group-by)
- [ ] Update health API to show per-source sync status
- [ ] Update session list API/UI with source column + filter
- [ ] Update daily stats API for per-source breakdown
- [ ] Update dashboard KPIs template for combined + per-source view
- [ ] Migrate seed script to set `source='opencode'` on seeded data
- [ ] Update all tests for new schema (source column, flat TokenRecord, moved files)

## Migration Risks

1. **`daily_stats` PK change**: Requires table rebuild (rename-create-copy-drop). Same pattern used in existing `migrateSessionsTableV2`. Safe.
2. **File moves**: `source-db.ts` and schemas change import paths. All importers must update. TypeScript compiler catches missed ones.
3. **`TokenRecord` flattening**: Breaks all existing consumers. Confined to internals (not an external API). TypeScript catches all breakage.
4. **`source` column backfill**: Existing rows get `DEFAULT 'opencode'`. Zero data loss.
5. **Cursor key rename**: One-time migration in `ensureMigrations()`. Update existing rows from `opencode_session` to `opencode:session`.

## Principles for Future Harnesses

When adding a new harness (e.g. Cursor, Aider, Windsurf):

1. Create `src/adapters/<harness>/adapter.ts` implementing `SourceAdapter`.
2. Put harness-specific schemas in `src/adapters/<harness>/schemas/`.
3. Add a `SourceConfig` variant to `config.ts`.
4. Add a case to `buildAdapters()` in `main.ts`.
5. Done. No changes to dashboard-db, stats, API, or UI needed.

Harness-specific metrics (things only that harness tracks) go in the `metadata` JSON column. If a metric appears in 2+ harnesses, consider promoting it to a real column.
