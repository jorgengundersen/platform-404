import type { Database } from "bun:sqlite";
import { Context, Data, Effect, Layer } from "effect";
import { OpenCodeAdapter } from "@/adapters/opencode/adapter";
import type { NormalizedBatch } from "@/primitives/schemas/normalized-batch";
import { bucketByDay } from "@/primitives/time";
import { DashboardDb } from "@/services/dashboard-db";
import type { SourceAdapter } from "@/services/source-adapter";

export class IngestionError extends Data.TaggedError("IngestionError")<{
  readonly reason: string;
  readonly cause?: unknown;
}> {}

export class IngestionService extends Context.Tag("IngestionService")<
  IngestionService,
  {
    readonly ingestOnce: Effect.Effect<void, IngestionError>;
  }
>() {}

function extractAgent(metadata: Record<string, unknown> | null): string | null {
  if (metadata === null) return null;
  const value = metadata.agent;
  return typeof value === "string" ? value : null;
}

function writeBatch(
  sqlite: Database,
  batch: NormalizedBatch,
): Effect.Effect<void, IngestionError> {
  return Effect.gen(function* () {
    const now = Date.now();

    sqlite.exec("BEGIN TRANSACTION");
    try {
      const upsertMessage = sqlite.prepare(`
        INSERT INTO messages (
          id, source, metadata, session_id, role, provider_id, model_id, agent,
          cost, tokens_input, tokens_output, tokens_reasoning,
          cache_read, cache_write, time_created, time_ingested
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          source = excluded.source,
          metadata = excluded.metadata,
          session_id = excluded.session_id,
          role = excluded.role,
          provider_id = excluded.provider_id,
          model_id = excluded.model_id,
          agent = excluded.agent,
          cost = excluded.cost,
          tokens_input = excluded.tokens_input,
          tokens_output = excluded.tokens_output,
          tokens_reasoning = excluded.tokens_reasoning,
          cache_read = excluded.cache_read,
          cache_write = excluded.cache_write,
          time_created = excluded.time_created,
          time_ingested = excluded.time_ingested
      `);

      for (const message of batch.messages) {
        upsertMessage.run(
          message.id,
          message.source,
          message.metadata === null ? null : JSON.stringify(message.metadata),
          message.sessionId,
          message.role,
          message.providerId,
          message.modelId,
          extractAgent(message.metadata),
          message.cost,
          message.tokensInput,
          message.tokensOutput,
          message.tokensReasoning,
          message.cacheRead,
          message.cacheWrite,
          message.timeCreated,
          now,
        );
      }

      const upsertSession = sqlite.prepare(`
        INSERT INTO sessions (
          id, source, metadata, project_id, project_name, title,
          message_count, total_cost, total_tokens_input, total_tokens_output,
          total_tokens_reasoning, total_cache_read, total_cache_write,
          time_created, time_updated, time_ingested
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          source = excluded.source,
          metadata = excluded.metadata,
          project_id = excluded.project_id,
          project_name = excluded.project_name,
          title = excluded.title,
          message_count = excluded.message_count,
          total_cost = excluded.total_cost,
          total_tokens_input = excluded.total_tokens_input,
          total_tokens_output = excluded.total_tokens_output,
          total_tokens_reasoning = excluded.total_tokens_reasoning,
          total_cache_read = excluded.total_cache_read,
          total_cache_write = excluded.total_cache_write,
          time_created = excluded.time_created,
          time_updated = excluded.time_updated,
          time_ingested = excluded.time_ingested
      `);

      for (const session of batch.sessions) {
        upsertSession.run(
          session.id,
          session.source,
          session.metadata === null ? null : JSON.stringify(session.metadata),
          session.projectId,
          session.projectName,
          session.title,
          session.messageCount,
          session.totalCost,
          session.totalTokensInput,
          session.totalTokensOutput,
          session.totalTokensReasoning,
          session.totalCacheRead,
          session.totalCacheWrite,
          session.timeCreated,
          session.timeUpdated,
          now,
        );
      }

      const upsertDaily = sqlite.prepare(`
        INSERT INTO daily_stats (
          date, source, session_count, message_count, total_cost,
          total_tokens_input, total_tokens_output, total_tokens_reasoning,
          total_cache_read, total_cache_write, time_updated
        )
        SELECT
          ? AS date,
          ? AS source,
          COUNT(DISTINCT s.id) AS session_count,
          COALESCE(SUM(s.message_count), 0) AS message_count,
          COALESCE(SUM(s.total_cost), 0) AS total_cost,
          COALESCE(SUM(s.total_tokens_input), 0) AS total_tokens_input,
          COALESCE(SUM(s.total_tokens_output), 0) AS total_tokens_output,
          COALESCE(SUM(s.total_tokens_reasoning), 0) AS total_tokens_reasoning,
          COALESCE(SUM(s.total_cache_read), 0) AS total_cache_read,
          COALESCE(SUM(s.total_cache_write), 0) AS total_cache_write,
          ? AS time_updated
        FROM sessions s
        WHERE date(s.time_updated / 1000, 'unixepoch') = ?
          AND s.source = ?
        ON CONFLICT(date, source) DO UPDATE SET
          session_count = excluded.session_count,
          message_count = excluded.message_count,
          total_cost = excluded.total_cost,
          total_tokens_input = excluded.total_tokens_input,
          total_tokens_output = excluded.total_tokens_output,
          total_tokens_reasoning = excluded.total_tokens_reasoning,
          total_cache_read = excluded.total_cache_read,
          total_cache_write = excluded.total_cache_write,
          time_updated = excluded.time_updated
      `);

      const dateBuckets = new Set(
        batch.sessions.map((session) => bucketByDay(session.timeUpdated)),
      );
      for (const date of dateBuckets) {
        upsertDaily.run(date, batch.source, now, date, batch.source);
      }

      const cursorUpdates =
        batch.cursorUpdates.length > 0
          ? batch.cursorUpdates
          : [{ key: batch.cursorKey, value: batch.cursorValue }];
      const upsertCursor = sqlite.prepare(`
        INSERT INTO ingestion_cursor (source, last_time_updated, last_synced_at)
        VALUES (?, ?, ?)
        ON CONFLICT(source) DO UPDATE SET
          last_time_updated = excluded.last_time_updated,
          last_synced_at = excluded.last_synced_at
      `);

      for (const cursor of cursorUpdates) {
        upsertCursor.run(cursor.key, cursor.value, now);
      }

      sqlite.exec("COMMIT");
    } catch (cause) {
      sqlite.exec("ROLLBACK");
      yield* Effect.fail(
        new IngestionError({ reason: "Transaction failed", cause }),
      );
    }
  });
}

// Shared core: run all adapters sequentially, catch errors per adapter.
function buildIngestOnce(
  adapters: SourceAdapter[],
  sqlite: Database,
): Effect.Effect<void, IngestionError> {
  return Effect.forEach(
    adapters,
    (adapter) =>
      Effect.gen(function* () {
        const batch = yield* adapter.fetchBatch;
        if (batch === null) return;
        yield* writeBatch(sqlite, batch);
      }).pipe(
        Effect.mapError(
          (cause) =>
            new IngestionError({
              reason: `Failed to ingest from ${adapter.source}`,
              cause,
            }),
        ),
        Effect.catchAll((e) =>
          Effect.sync(() => {
            console.error(`[ingestion:${adapter.source}] error:`, e.reason);
          }),
        ),
      ),
    { concurrency: 1 },
  ).pipe(Effect.map(() => undefined));
}

/**
 * makeIngestionServiceLive - factory for multi-adapter ingestion.
 *
 * Accepts a list of SourceAdapters as plain values (not Effect context).
 * Each adapter is called sequentially on every ingestOnce tick.
 * Adapter errors are caught per-adapter and do not stop other adapters.
 */
export function makeIngestionServiceLive(
  adapters: SourceAdapter[],
): Layer.Layer<IngestionService, never, DashboardDb> {
  return Layer.effect(
    IngestionService,
    Effect.gen(function* () {
      const { sqlite } = yield* DashboardDb;
      return { ingestOnce: buildIngestOnce(adapters, sqlite) };
    }),
  );
}

/**
 * IngestionServiceLive - single OpenCode adapter ingestion layer.
 *
 * Resolves OpenCodeAdapter from Effect context and delegates to buildIngestOnce.
 */
export const IngestionServiceLive: Layer.Layer<
  IngestionService,
  never,
  OpenCodeAdapter | DashboardDb
> = Layer.effect(
  IngestionService,
  Effect.gen(function* () {
    const adapter = yield* OpenCodeAdapter;
    const { sqlite } = yield* DashboardDb;
    return { ingestOnce: buildIngestOnce([adapter], sqlite) };
  }),
);
