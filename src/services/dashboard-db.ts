import { Database } from "bun:sqlite";
import { Context, Data, Effect, Layer } from "effect";

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class DashboardDbError extends Data.TaggedError("DashboardDbError")<{
  readonly reason: string;
  readonly cause?: unknown;
}> {}

// ---------------------------------------------------------------------------
// Service interface
// ---------------------------------------------------------------------------

export class DashboardDb extends Context.Tag("DashboardDb")<
  DashboardDb,
  {
    readonly sqlite: Database;
  }
>() {}

// ---------------------------------------------------------------------------
// Migrations
// ---------------------------------------------------------------------------

function ensureMigrations(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ingestion_cursor (
      source TEXT PRIMARY KEY,
      last_time_updated INTEGER,
      last_synced_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      project_name TEXT,
      title TEXT,
      version TEXT,
      summary_additions INTEGER,
      summary_deletions INTEGER,
      summary_files INTEGER,
      message_count INTEGER,
      total_cost REAL,
      total_tokens_input INTEGER,
      total_tokens_output INTEGER,
      total_tokens_reasoning INTEGER,
      total_cache_read INTEGER,
      total_cache_write INTEGER,
      time_created INTEGER,
      time_updated INTEGER,
      time_ingested INTEGER
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      role TEXT,
      provider_id TEXT,
      model_id TEXT,
      agent TEXT,
      cost REAL,
      tokens_input INTEGER,
      tokens_output INTEGER,
      tokens_reasoning INTEGER,
      cache_read INTEGER,
      cache_write INTEGER,
      time_created INTEGER,
      time_ingested INTEGER
    );

    CREATE TABLE IF NOT EXISTS daily_stats (
      date TEXT PRIMARY KEY,
      session_count INTEGER,
      message_count INTEGER,
      total_cost REAL,
      total_tokens_input INTEGER,
      total_tokens_output INTEGER,
      total_tokens_reasoning INTEGER,
      total_cache_read INTEGER,
      total_cache_write INTEGER,
      time_updated INTEGER
    );
  `);

  migrateSessionsTableV2(db);
}

function migrateSessionsTableV2(db: Database): void {
  const sessionsExists = db
    .query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'",
    )
    .get() as { name: string } | null;

  if (!sessionsExists) {
    return;
  }

  const columns = db.query("PRAGMA table_info(sessions)").all() as Array<{
    name: string;
    type: string;
  }>;

  const columnNames = columns.map((c) => c.name);
  const idColumn = columns.find((c) => c.name === "id");
  const hasProjectName = columnNames.includes("project_name");

  const needsRebuild = idColumn?.type !== "TEXT";

  if (needsRebuild) {
    db.exec(`
      ALTER TABLE sessions RENAME TO sessions_old;

      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        project_name TEXT,
        title TEXT,
        version TEXT,
        summary_additions INTEGER,
        summary_deletions INTEGER,
        summary_files INTEGER,
        message_count INTEGER,
        total_cost REAL,
        total_tokens_input INTEGER,
        total_tokens_output INTEGER,
        total_tokens_reasoning INTEGER,
        total_cache_read INTEGER,
        total_cache_write INTEGER,
        time_created INTEGER,
        time_updated INTEGER,
        time_ingested INTEGER
      );

      INSERT INTO sessions (
        id, project_id, project_name, title, version, summary_additions,
        summary_deletions, summary_files, message_count, total_cost,
        total_tokens_input, total_tokens_output, total_tokens_reasoning,
        total_cache_read, total_cache_write, time_created, time_updated, time_ingested
      )
      SELECT
        CAST(id AS TEXT),
        project_id,
        NULL,
        title,
        version,
        summary_additions,
        summary_deletions,
        summary_files,
        message_count,
        total_cost,
        total_tokens_input,
        total_tokens_output,
        total_tokens_reasoning,
        total_cache_read,
        total_cache_write,
        time_created,
        time_updated,
        time_ingested
      FROM sessions_old;

      DROP TABLE sessions_old;
    `);
  } else if (!hasProjectName) {
    db.exec(`ALTER TABLE sessions ADD COLUMN project_name TEXT;`);
  }
}

// ---------------------------------------------------------------------------
// Layers
// ---------------------------------------------------------------------------

/**
 * DashboardDbLive - read-write Layer for the given file path.
 * Runs migrations on startup.
 */
export const DashboardDbLive = (
  dbPath: string,
): Layer.Layer<DashboardDb, DashboardDbError> =>
  Layer.effect(
    DashboardDb,
    Effect.try({
      try: () => {
        const sqlite = new Database(dbPath);
        ensureMigrations(sqlite);
        return { sqlite };
      },
      catch: (cause) =>
        new DashboardDbError({
          reason: "Failed to open dashboard database",
          cause,
        }),
    }),
  );

/**
 * DashboardDbTest - in-memory Layer for tests.
 */
export const DashboardDbTest: Layer.Layer<DashboardDb, DashboardDbError> =
  Layer.effect(
    DashboardDb,
    Effect.try({
      try: () => {
        const sqlite = new Database(":memory:");
        ensureMigrations(sqlite);
        return { sqlite };
      },
      catch: (cause) =>
        new DashboardDbError({
          reason: "Failed to open in-memory database",
          cause,
        }),
    }),
  );
