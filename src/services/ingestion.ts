import { Schema } from "@effect/schema";
import { Context, Data, Effect, Layer, Option } from "effect";

import { safeParseJson } from "@/primitives/json";
import {
  AssistantMessageData,
  UserMessageData,
} from "@/primitives/schemas/message-data";
import { bucketByDay } from "@/primitives/time";
import { DashboardDb } from "@/services/dashboard-db";
import { SourceDb } from "@/services/source-db";

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class IngestionError extends Data.TaggedError("IngestionError")<{
  readonly reason: string;
  readonly cause?: unknown;
}> {}

// ---------------------------------------------------------------------------
// Service interface
// ---------------------------------------------------------------------------

export class IngestionService extends Context.Tag("IngestionService")<
  IngestionService,
  {
    readonly ingestOnce: Effect.Effect<void, IngestionError>;
  }
>() {}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const decodeAssistant = Schema.decodeUnknownOption(AssistantMessageData);
const decodeUser = Schema.decodeUnknownOption(UserMessageData);

// ---------------------------------------------------------------------------
// Layer
// ---------------------------------------------------------------------------

export const IngestionServiceLive: Layer.Layer<
  IngestionService,
  never,
  SourceDb | DashboardDb
> = Layer.effect(
  IngestionService,
  Effect.gen(function* () {
    const sourceDb = yield* SourceDb;
    const { sqlite } = yield* DashboardDb;

    const ingestOnce = Effect.gen(function* () {
      // ---- 1. Sessions ----
      const sessionCursorRow = sqlite
        .query(
          "SELECT last_time_updated FROM ingestion_cursor WHERE source = 'opencode_session'",
        )
        .get() as { last_time_updated: number } | null;

      const sessionSinceMs = sessionCursorRow?.last_time_updated ?? -1;

      const sessions = yield* sourceDb
        .listSessionsUpdatedSince(sessionSinceMs)
        .pipe(
          Effect.mapError(
            (e) =>
              new IngestionError({
                reason: "Failed to list sessions",
                cause: e,
              }),
          ),
        );

      if (sessions.length === 0) return;

      const projectIds = Array.from(new Set(sessions.map((s) => s.project_id)));
      const projects = yield* sourceDb.listProjectsByIds(projectIds).pipe(
        Effect.mapError(
          (e) =>
            new IngestionError({
              reason: "Failed to list projects",
              cause: e,
            }),
        ),
      );
      const projectNameMap = new Map(projects.map((p) => [p.id, p.name]));

      // ---- 2. Messages ----
      const sessionIds = sessions.map((s) => s.id);
      const messages = yield* sourceDb.listMessagesForSessions(sessionIds).pipe(
        Effect.mapError(
          (e) =>
            new IngestionError({
              reason: "Failed to list messages",
              cause: e,
            }),
        ),
      );

      const now = Date.now();

      // ---- 4. Write everything in one transaction ----
      sqlite.exec("BEGIN TRANSACTION");
      try {
        // Upsert messages
        const upsertMsg = sqlite.prepare(`
          INSERT INTO messages (
            id, session_id, role, provider_id, model_id, agent,
            cost, tokens_input, tokens_output, tokens_reasoning,
            cache_read, cache_write, time_created, time_ingested
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
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
            time_ingested = excluded.time_ingested
        `);

        for (const msg of messages) {
          const parsed = safeParseJson(msg.data);
          const raw = Option.getOrNull(parsed);

          const assistant =
            raw !== null ? Option.getOrNull(decodeAssistant(raw)) : null;
          const user = raw !== null ? Option.getOrNull(decodeUser(raw)) : null;

          if (assistant !== null) {
            upsertMsg.run(
              msg.id,
              msg.session_id,
              "assistant",
              assistant.providerID,
              assistant.modelID,
              null,
              assistant.cost,
              assistant.tokens.input,
              assistant.tokens.output,
              assistant.tokens.reasoning,
              assistant.tokens.cache.read,
              assistant.tokens.cache.write,
              msg.time_created,
              now,
            );
          } else if (user !== null) {
            upsertMsg.run(
              msg.id,
              msg.session_id,
              "user",
              user.model.providerID,
              user.model.modelID,
              user.agent,
              null,
              null,
              null,
              null,
              null,
              null,
              msg.time_created,
              now,
            );
          } else {
            // Unknown role/format: still insert with minimal data
            const roleRaw =
              raw !== null &&
              typeof raw === "object" &&
              "role" in raw &&
              typeof (raw as Record<string, unknown>).role === "string"
                ? (raw as Record<string, unknown>).role
                : "unknown";
            const role = String(roleRaw);
            upsertMsg.run(
              msg.id,
              msg.session_id,
              role,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              msg.time_created,
              now,
            );
          }
        }

        // Compute per-session aggregates from ingested messages
        // Group messages by session_id
        const sessionMsgMap = new Map<
          string,
          {
            cost: number;
            tokens_input: number;
            tokens_output: number;
            tokens_reasoning: number;
            cache_read: number;
            cache_write: number;
            count: number;
          }
        >();

        for (const msg of messages) {
          const existing = sessionMsgMap.get(msg.session_id) ?? {
            cost: 0,
            tokens_input: 0,
            tokens_output: 0,
            tokens_reasoning: 0,
            cache_read: 0,
            cache_write: 0,
            count: 0,
          };

          const parsed = safeParseJson(msg.data);
          const raw = Option.getOrNull(parsed);
          const assistant =
            raw !== null ? Option.getOrNull(decodeAssistant(raw)) : null;

          sessionMsgMap.set(msg.session_id, {
            cost: existing.cost + (assistant?.cost ?? 0),
            tokens_input:
              existing.tokens_input + (assistant?.tokens.input ?? 0),
            tokens_output:
              existing.tokens_output + (assistant?.tokens.output ?? 0),
            tokens_reasoning:
              existing.tokens_reasoning + (assistant?.tokens.reasoning ?? 0),
            cache_read:
              existing.cache_read + (assistant?.tokens.cache.read ?? 0),
            cache_write:
              existing.cache_write + (assistant?.tokens.cache.write ?? 0),
            count: existing.count + 1,
          });
        }

        // Upsert sessions
        const upsertSession = sqlite.prepare(`
          INSERT INTO sessions (
            id, project_id, project_name, title,
            message_count, total_cost,
            total_tokens_input, total_tokens_output, total_tokens_reasoning,
            total_cache_read, total_cache_write,
            time_updated, time_ingested
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
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
            time_updated = excluded.time_updated,
            time_ingested = excluded.time_ingested
        `);

        for (const session of sessions) {
          const projectName = projectNameMap.get(session.project_id) ?? null;
          const agg = sessionMsgMap.get(session.id) ?? {
            cost: 0,
            tokens_input: 0,
            tokens_output: 0,
            tokens_reasoning: 0,
            cache_read: 0,
            cache_write: 0,
            count: 0,
          };

          upsertSession.run(
            session.id,
            session.project_id,
            projectName,
            session.title,
            agg.count,
            agg.cost,
            agg.tokens_input,
            agg.tokens_output,
            agg.tokens_reasoning,
            agg.cache_read,
            agg.cache_write,
            session.time_updated,
            now,
          );
        }

        // Upsert daily_stats: recompute for each date bucket touched by new sessions
        const dateBuckets = new Set(
          sessions.map((s) => bucketByDay(s.time_updated)),
        );

        const upsertDaily = sqlite.prepare(`
          INSERT INTO daily_stats (
            date, session_count, message_count, total_cost,
            total_tokens_input, total_tokens_output, total_tokens_reasoning,
            total_cache_read, total_cache_write, time_updated
          )
          SELECT
            ? AS date,
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
          ON CONFLICT(date) DO UPDATE SET
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

        for (const date of dateBuckets) {
          upsertDaily.run(date, now, date);
        }

        // Update session cursor
        const maxSessionTime =
          sessions[sessions.length - 1]?.time_updated ?? sessionSinceMs;
        sqlite
          .prepare(`
            INSERT INTO ingestion_cursor (source, last_time_updated, last_synced_at)
            VALUES ('opencode_session', ?, ?)
            ON CONFLICT(source) DO UPDATE SET
              last_time_updated = ?,
              last_synced_at = ?
          `)
          .run(maxSessionTime, now, maxSessionTime, now);

        // Update message cursor (use max time_updated from messages, or now)
        const maxMsgTime =
          messages.length > 0
            ? Math.max(...messages.map((m) => m.time_updated))
            : now;
        sqlite
          .prepare(`
            INSERT INTO ingestion_cursor (source, last_time_updated, last_synced_at)
            VALUES ('opencode_message', ?, ?)
            ON CONFLICT(source) DO UPDATE SET
              last_time_updated = ?,
              last_synced_at = ?
          `)
          .run(maxMsgTime, now, maxMsgTime, now);

        sqlite.exec("COMMIT");
      } catch (error) {
        sqlite.exec("ROLLBACK");
        yield* Effect.fail(
          new IngestionError({ reason: "Transaction failed", cause: error }),
        );
      }
    });

    return { ingestOnce };
  }),
);

// ---------------------------------------------------------------------------
// Legacy exports (backward compat)
// ---------------------------------------------------------------------------

import type { Database } from "bun:sqlite";
import {
  listProjectsByIds,
  listSessionsUpdatedSince,
} from "@/services/source-db";

/**
 * @deprecated Use IngestionService Effect service instead.
 */
export function ingestOnce(sourceDb: Database, dashboardDb: Database): void {
  const cursorRow = dashboardDb
    .query("SELECT last_time_updated FROM ingestion_cursor WHERE source = ?")
    .get("opencode_session") as { last_time_updated: number } | null;

  const sinceMs = cursorRow?.last_time_updated ?? -1;

  const sessions = listSessionsUpdatedSince(sourceDb, sinceMs);

  if (sessions.length === 0) {
    return;
  }

  const projectIds = Array.from(new Set(sessions.map((s) => s.project_id)));
  const projects = listProjectsByIds(sourceDb, projectIds);
  const projectNameMap = new Map(projects.map((p) => [p.id, p.name]));

  const now = Date.now();

  dashboardDb.exec("BEGIN TRANSACTION");

  try {
    const upsertStmt = dashboardDb.prepare(
      "INSERT INTO sessions (id, project_id, project_name, title, time_updated, time_ingested) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET project_id = excluded.project_id, project_name = excluded.project_name, title = excluded.title, time_updated = excluded.time_updated, time_ingested = excluded.time_ingested",
    );

    for (const session of sessions) {
      const projectName = projectNameMap.get(session.project_id) ?? null;
      upsertStmt.run(
        session.id,
        session.project_id,
        projectName,
        session.title,
        session.time_updated,
        now,
      );
    }

    const maxTime = sessions[sessions.length - 1]?.time_updated ?? sinceMs;

    const cursorStmt = dashboardDb.prepare(
      "INSERT INTO ingestion_cursor (source, last_time_updated, last_synced_at) VALUES (?, ?, ?) ON CONFLICT(source) DO UPDATE SET last_time_updated = ?, last_synced_at = ?",
    );

    cursorStmt.run("opencode_session", maxTime, now, maxTime, now);

    dashboardDb.exec("COMMIT");
  } catch (error) {
    dashboardDb.exec("ROLLBACK");
    throw error;
  }
}
