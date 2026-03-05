import { Database } from "bun:sqlite";
import { Context, Data, Effect, Layer } from "effect";

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

export interface SessionRow {
  id: string;
  project_id: string;
  title: string;
  time_created: number;
  time_updated: number;
}

export interface ProjectRow {
  id: string;
  name: string;
}

export interface MessageRow {
  id: string;
  session_id: string;
  data: string;
  time_created: number;
  time_updated: number;
}

export interface PartRow {
  id: string;
  message_id: string;
  session_id: string;
  data: string;
  time_created: number;
  time_updated: number;
}

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class SourceDbError extends Data.TaggedError("SourceDbError")<{
  readonly reason: string;
  readonly cause?: unknown;
}> {}

// ---------------------------------------------------------------------------
// Service interface
// ---------------------------------------------------------------------------

export class SourceDb extends Context.Tag("SourceDb")<
  SourceDb,
  {
    readonly listSessionsUpdatedSince: (
      sinceMs: number,
    ) => Effect.Effect<SessionRow[], SourceDbError>;
    readonly listProjectsByIds: (
      ids: string[],
    ) => Effect.Effect<ProjectRow[], SourceDbError>;
    readonly listMessagesForSessions: (
      sessionIds: string[],
    ) => Effect.Effect<MessageRow[], SourceDbError>;
    readonly listPartsForMessages: (
      messageIds: string[],
    ) => Effect.Effect<PartRow[], SourceDbError>;
  }
>() {}

// ---------------------------------------------------------------------------
// Layer
// ---------------------------------------------------------------------------

export const SourceDbLive = (
  dbPath: string,
): Layer.Layer<SourceDb, SourceDbError> =>
  Layer.effect(
    SourceDb,
    Effect.try({
      try: () => {
        const sqlite = new Database(dbPath, { readonly: true });
        sqlite.exec("PRAGMA query_only=ON");

        return {
          listSessionsUpdatedSince: (sinceMs: number) =>
            Effect.try({
              try: () =>
                sqlite
                  .query(
                    "SELECT id, project_id, title, time_created, time_updated FROM session WHERE time_updated > ? ORDER BY time_updated ASC",
                  )
                  .all(sinceMs) as SessionRow[],
              catch: (cause) =>
                new SourceDbError({
                  reason: "listSessionsUpdatedSince failed",
                  cause,
                }),
            }),

          listProjectsByIds: (ids: string[]) =>
            Effect.try({
              try: () => {
                if (ids.length === 0) return [];
                const placeholders = ids.map(() => "?").join(",");
                return sqlite
                  .query(
                    `SELECT id, name FROM project WHERE id IN (${placeholders})`,
                  )
                  .all(...ids) as ProjectRow[];
              },
              catch: (cause) =>
                new SourceDbError({
                  reason: "listProjectsByIds failed",
                  cause,
                }),
            }),

          listMessagesForSessions: (sessionIds: string[]) =>
            Effect.try({
              try: () => {
                if (sessionIds.length === 0) return [];
                const placeholders = sessionIds.map(() => "?").join(",");
                return sqlite
                  .query(
                    `SELECT id, session_id, data, time_created, time_updated FROM message WHERE session_id IN (${placeholders}) ORDER BY time_created ASC`,
                  )
                  .all(...sessionIds) as MessageRow[];
              },
              catch: (cause) =>
                new SourceDbError({
                  reason: "listMessagesForSessions failed",
                  cause,
                }),
            }),

          listPartsForMessages: (messageIds: string[]) =>
            Effect.try({
              try: () => {
                if (messageIds.length === 0) return [];
                const placeholders = messageIds.map(() => "?").join(",");
                return sqlite
                  .query(
                    `SELECT id, message_id, session_id, data, time_created, time_updated FROM part WHERE message_id IN (${placeholders}) ORDER BY time_created ASC`,
                  )
                  .all(...messageIds) as PartRow[];
              },
              catch: (cause) =>
                new SourceDbError({
                  reason: "listPartsForMessages failed",
                  cause,
                }),
            }),
        };
      },
      catch: (cause) =>
        new SourceDbError({ reason: "Failed to open source database", cause }),
    }),
  );
