# Claude Code Integration

Spec for adding Claude Code as a data source alongside existing OpenCode ingestion.

## Status

- Additive to existing architecture. OpenCode ingestion stays.
- **Depends on**: `specs/source-abstraction.md` (must land first). That spec defines the `SourceAdapter` interface, `NormalizedBatch` contract, and `source` column on dashboard tables. This spec builds on top of that foundation.

## Context

Claude Code is Anthropic's agentic coding tool. It stores session data locally and exposes telemetry via OpenTelemetry (OTel). Unlike OpenCode (which uses a local SQLite DB we read directly), Claude Code has **no documented local SQLite schema** we can rely on. The official data interfaces are:

1. **OpenTelemetry metrics + events** (primary, documented, stable)
2. **CLI JSON output** (`claude -p --output-format json`)
3. **Local session files** (undocumented, unstable, not recommended)

This spec focuses on **Option 1: OTel ingestion** as the primary integration path, with Option 2 as a supplementary enrichment mechanism.

## Goals

- Ingest Claude Code usage data (sessions, costs, tokens, models) into dashboard.db.
- Display Claude Code data alongside OpenCode data in all dashboard views.
- Unified analytics: cross-tool cost tracking, model comparison, trend analysis.
- Zero changes to existing OpenCode ingestion pipeline.

## Non-goals

- No real-time streaming dashboard (batch is fine).
- No authentication/multi-user (stays personal use).
- No direct reading of Claude Code's undocumented local files.
- No PR attribution or GitHub integration (Claude Code's analytics dashboard handles that).
- No replacing Anthropic's own analytics dashboard; this is personal/local-first.

## Claude Code Data Model (from official docs)

### OTel Metrics

| Metric | Unit | Key Attributes |
|--------|------|----------------|
| `claude_code.session.count` | count | `session.id`, `user.account_uuid` |
| `claude_code.token.usage` | tokens | `type` (input/output/cacheRead/cacheCreation), `model` |
| `claude_code.cost.usage` | USD | `model` |
| `claude_code.lines_of_code.count` | count | `type` (added/removed) |
| `claude_code.commit.count` | count | |
| `claude_code.pull_request.count` | count | |
| `claude_code.code_edit_tool.decision` | count | `tool_name`, `decision` (accept/reject) |
| `claude_code.active_time.total` | seconds | `type` (user/cli) |

All metrics include standard attrs: `session.id`, `app.version`, `organization.id`, `user.account_uuid`, `user.id`, `terminal.type`.

### OTel Events (via logs exporter)

| Event | Key Attributes |
|-------|----------------|
| `claude_code.user_prompt` | `prompt_length`, `prompt` (if opted in) |
| `claude_code.tool_result` | `tool_name`, `success`, `duration_ms`, `decision_type` |
| `claude_code.api_request` | `model`, `cost_usd`, `duration_ms`, `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_creation_tokens` |
| `claude_code.api_error` | `model`, `error`, `status_code`, `duration_ms` |

Events share a `prompt.id` for correlation (all events from a single user prompt).

### CLI JSON Output

`claude -p "..." --output-format json` returns:

```json
{
  "result": "...",
  "session_id": "...",
  "usage": { ... }
}
```

Useful for enrichment but not the primary ingestion path.

## Architecture

### High-Level Data Flow

```
Claude Code ──(OTel OTLP)──> OTel Collector ──(OTLP export)──> Platform-404 OTel Receiver
                                                                        │
                                                                        v
opencode.db ──(SQLite read)──> IngestionService ──> dashboard.db <── OTel Ingestion
                                                        │
                                                        v
                                                   API / UI
```

### Option A: Embedded OTel Receiver (Recommended)

Platform-404 runs a lightweight OTLP HTTP receiver endpoint. Claude Code sends metrics + events directly (or via an OTel Collector sidecar).

- New `POST /otlp/v1/metrics` endpoint (OTLP HTTP/JSON or HTTP/protobuf)
- New `POST /otlp/v1/logs` endpoint (for events)
- Platform-404 parses OTLP payloads, maps to dashboard.db tables

Pros: simple, self-contained, no extra infra.
Cons: must implement OTLP HTTP parsing.

### Option B: OTel Collector + File/SQLite Bridge

OTel Collector receives from Claude Code, exports to a local file (JSON lines) or SQLite DB. Platform-404 reads that file/DB the same way it reads opencode.db.

Pros: decouples OTel parsing from platform. Cons: extra moving part (collector config).

### Recommendation

**Option A** for simplicity. The OTLP HTTP/JSON protocol is straightforward to parse. The receiver is a few HTTP route handlers that buffer and batch-write to dashboard.db.

## Database Schema Changes

**Revised**: This spec no longer defines separate `claude_code_*` tables. Per `specs/source-abstraction.md`, all harness data flows through the unified `sessions`, `messages`, `daily_stats` tables with `source='claude_code'`. Harness-specific metrics go in the `metadata` JSON column.

### How Claude Code data maps to normalized schema

The Claude Code OTel adapter produces `NormalizedBatch` records:

**NormalizedSession** (from accumulated OTel metrics per `session.id`):
- `source` = `"claude_code"`
- `totalCost` = sum of `cost.usage` metric deltas
- `totalTokensInput/Output` = sum of `token.usage` by type
- `totalTokensReasoning` = 0 (CC OTel doesn't expose reasoning tokens)
- `totalCacheRead` = sum of `token.usage` where type=cacheRead
- `totalCacheWrite` = sum of `token.usage` where type=cacheCreation (normalized name)
- `messageCount` = count of unique `prompt.id` values (one "turn" per prompt)
- `projectId/Name` = NULL (CC OTel has no project info)
- `timeCreated` = first metric timestamp for this session
- `timeUpdated` = last metric timestamp for this session
- `metadata` = `{ appVersion, terminalType, linesAdded, linesRemoved, commits, pullRequests, activeTimeUserS, activeTimeCliS }`

**NormalizedMessage** (from `api_request` events):
- `source` = `"claude_code"`
- `role` = `"assistant"` (api_request = model turn)
- `modelId` = `model` attribute
- `providerId` = `"anthropic"` (default; inferred from model name for Bedrock/Vertex)
- `cost` = `cost_usd` attribute
- `tokensInput/Output` = from event attributes
- `cacheRead/Write` = `cache_read_tokens` / `cache_creation_tokens`
- `metadata` = `{ promptId, durationMs, speed }`

### Claude Code-specific detail tables (optional, additive)

For tool usage analytics (not available from other harnesses), the adapter MAY write to an optional detail table:

**`source_events`** (generic event log, any source can write here):

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK AUTOINCREMENT | |
| source | TEXT | `"claude_code"` |
| session_id | TEXT | |
| event_type | TEXT | `"tool_result"`, `"api_error"`, `"user_prompt"`, etc |
| data | TEXT | JSON blob with event-specific attributes |
| timestamp | INTEGER | unix ms |

This is a generic event table, not Claude Code-specific. Any future harness can write events here. The Claude Code adapter populates it with `tool_result` and `api_error` events.

### Ingestion cursor

Uses key `claude_code:otel` in the existing `ingestion_cursor` table. Cursor value = last processed timestamp.

## OTel Receiver Implementation

### New service: `OtelReceiver`

Effect service, same pattern as existing services.

```
src/services/otel-receiver.ts
```

Responsibilities:
- Expose OTLP HTTP/JSON endpoints
- Parse metric data points and log records from OTLP payloads
- Buffer incoming data (in-memory, flush on interval or threshold)
- Write to `claude_code_sessions`, `claude_code_api_requests`, `claude_code_tool_results`
- Update `daily_stats` cc_* columns
- Advance `ingestion_cursor` for `claude_code` source

### OTLP HTTP/JSON Parsing

OTLP HTTP/JSON is a well-defined protobuf-to-JSON mapping. Key structures:

**Metrics** (`POST /otlp/v1/metrics`):
```
ExportMetricsServiceRequest {
  resource_metrics: [{
    resource: { attributes: [...] },
    scope_metrics: [{
      metrics: [{
        name: "claude_code.cost.usage",
        sum/gauge/histogram: {
          data_points: [{
            attributes: [...],
            as_double/as_int: value,
            time_unix_nano: ...
          }]
        }
      }]
    }]
  }]
}
```

**Logs/Events** (`POST /otlp/v1/logs`):
```
ExportLogsServiceRequest {
  resource_logs: [{
    scope_logs: [{
      log_records: [{
        attributes: [...],
        body: { string_value: "..." },
        time_unix_nano: ...
      }]
    }]
  }]
}
```

### Schema definitions

New `@effect/schema` definitions in `src/primitives/schemas/`:

- `otel-metrics.ts` - OTLP metrics request/response schemas
- `otel-logs.ts` - OTLP logs request/response schemas
- `claude-code.ts` - Claude Code specific metric/event attribute schemas

## Claude Code Configuration

User configures Claude Code to send OTel data to Platform-404:

```bash
# In Claude Code settings.json or environment
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_METRICS_EXPORTER=otlp
export OTEL_LOGS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_PROTOCOL=http/json
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:3000/otlp
export OTEL_METRIC_EXPORT_INTERVAL=10000
```

Or in Claude Code `settings.json`:
```json
{
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "OTEL_METRICS_EXPORTER": "otlp",
    "OTEL_LOGS_EXPORTER": "otlp",
    "OTEL_EXPORTER_OTLP_PROTOCOL": "http/json",
    "OTEL_EXPORTER_OTLP_ENDPOINT": "http://localhost:3000/otlp"
  }
}
```

## Dashboard Changes

### Unified views

All existing views gain a `source` dimension:

- **Dashboard KPIs**: combined spend, combined sessions, per-source breakdown
- **Sessions list**: new `source` column (`opencode` | `claude_code`), filterable
- **Models page**: Claude Code models appear alongside OpenCode models
- **Projects page**: OpenCode only (Claude Code OTel doesn't carry project info)
- **Daily detail**: combined daily stats with per-source breakdown

### New views

- `GET /claude-code` - Claude Code-specific overview (sessions, tool usage patterns, active time)
- `GET /claude-code/sessions/:id` - Claude Code session detail (API requests, tool results timeline)

### API additions

```
GET /api/stats/overview            # add cc_* fields to response
GET /api/stats/daily               # add cc_* columns
GET /api/claude-code/sessions      # paginated CC sessions
GET /api/claude-code/sessions/:id  # CC session detail with api_requests + tool_results
GET /api/claude-code/tools         # tool usage breakdown (name, success rate, avg duration)
```

## Migration Strategy

1. Add new tables + nullable columns via `ensureMigrations()` (same pattern as existing v2 migration)
2. Existing data untouched; new columns default NULL
3. OTel receiver starts accepting data immediately
4. Daily stats recomputation includes cc_* when data exists

## Implementation Plan

**Prerequisite**: Complete `specs/source-abstraction.md` first (adapter interface, source column, normalized batch, file moves).

- [ ] Add `@effect/schema` definitions for OTLP HTTP/JSON metric + log payloads (`adapters/claude-code/schemas/`)
- [ ] Implement OTel metric accumulator (buffer per session.id, produce `NormalizedBatch` on flush)
- [ ] Implement OTel event mapper (api_request -> NormalizedMessage, tool_result -> source_events)
- [ ] Implement `ClaudeCodeAdapter` (SourceAdapter impl: OTLP HTTP endpoints + accumulator + batch output)
- [ ] Add OTLP routes to HttpRouter (`POST /otlp/v1/metrics`, `POST /otlp/v1/logs`)
- [ ] Add `source_events` table migration
- [ ] Add `claude_code` SourceConfig variant + env var `CLAUDE_CODE_OTEL=1`
- [ ] Wire ClaudeCodeAdapter into main.ts adapter list
- [ ] Add Claude Code overview page (`GET /claude-code`) using source_events for tool analytics
- [ ] Add Claude Code session detail page (API requests timeline from messages, tool results from source_events)
- [ ] Update seed script: generate fake OTel data for dev
- [ ] Tests for OTLP parsing, accumulator, adapter, schema migrations

## Open Questions

1. **Metrics temporality**: Claude Code defaults to `delta` temporality. Accumulate session-level totals by summing deltas. Verify no double-counting on reconnect.
2. **Session boundary**: OTel metrics arrive as periodic exports. A "session" is identified by `session.id` attribute. Session is "complete" heuristically (no data for N minutes). Need a session-close timeout.
3. **Protobuf vs JSON**: Start with `http/json` (simpler to parse). Add `http/protobuf` later if needed for performance.
4. **OTel Collector sidecar**: For users who already run an OTel Collector, Platform-404 should accept standard OTLP. No custom protocol.
5. **Project mapping**: Claude Code OTel data lacks project info (it has `session.id` but no project/repo name). Could enrich by correlating `session.id` with git repo via Claude Code CLI or local session files, but this is fragile. Accept as a limitation initially.
