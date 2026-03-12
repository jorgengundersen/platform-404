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
      source TEXT DEFAULT 'opencode',
      metadata TEXT,
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
      source TEXT DEFAULT 'opencode',
      metadata TEXT,
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
      date TEXT,
      source TEXT DEFAULT 'opencode',
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
  `);

  migrateSessionsTableV2(db);
  migrateSourceAndMetadataColumns(db);
  migrateDailyStatsTableV2(db);
  migrateIngestionCursorKeysV2(db);
}

function tableHasColumn(
  db: Database,
  table: string,
  columnName: string,
): boolean {
  const columns = db.query(`PRAGMA table_info(${table})`).all() as Array<{
    name: string;
  }>;
  return columns.some((column) => column.name === columnName);
}

function migrateSourceAndMetadataColumns(db: Database): void {
  if (!tableHasColumn(db, "sessions", "source")) {
    db.exec("ALTER TABLE sessions ADD COLUMN source TEXT DEFAULT 'opencode';");
  }
  if (!tableHasColumn(db, "sessions", "metadata")) {
    db.exec("ALTER TABLE sessions ADD COLUMN metadata TEXT;");
  }
  db.exec("UPDATE sessions SET source = 'opencode' WHERE source IS NULL;");

  if (!tableHasColumn(db, "messages", "source")) {
    db.exec("ALTER TABLE messages ADD COLUMN source TEXT DEFAULT 'opencode';");
  }
  if (!tableHasColumn(db, "messages", "metadata")) {
    db.exec("ALTER TABLE messages ADD COLUMN metadata TEXT;");
  }
  db.exec("UPDATE messages SET source = 'opencode' WHERE source IS NULL;");
}

function migrateDailyStatsTableV2(db: Database): void {
  const dailyStatsExists = db
    .query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='daily_stats'",
    )
    .get() as { name: string } | null;

  if (!dailyStatsExists) {
    return;
  }

  const columns = db.query("PRAGMA table_info(daily_stats)").all() as Array<{
    name: string;
    pk: number;
  }>;

  const hasSource = columns.some((column) => column.name === "source");
  const hasCompositePk =
    columns.some((column) => column.name === "date" && column.pk === 1) &&
    columns.some((column) => column.name === "source" && column.pk === 2);

  if (hasSource && hasCompositePk) {
    return;
  }

  const sourceSelect = hasSource ? "source" : "'opencode'";

  db.exec(`
    ALTER TABLE daily_stats RENAME TO daily_stats_old;

    CREATE TABLE daily_stats (
      date TEXT,
      source TEXT DEFAULT 'opencode',
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

    INSERT INTO daily_stats (
      date,
      source,
      session_count,
      message_count,
      total_cost,
      total_tokens_input,
      total_tokens_output,
      total_tokens_reasoning,
      total_cache_read,
      total_cache_write,
      time_updated
    )
    SELECT
      date,
      ${sourceSelect},
      session_count,
      message_count,
      total_cost,
      total_tokens_input,
      total_tokens_output,
      total_tokens_reasoning,
      total_cache_read,
      total_cache_write,
      time_updated
    FROM daily_stats_old;

    DROP TABLE daily_stats_old;
  `);

  db.exec("UPDATE daily_stats SET source = 'opencode' WHERE source IS NULL;");
}

function migrateIngestionCursorKeysV2(db: Database): void {
  db.exec(`
    INSERT INTO ingestion_cursor (source, last_time_updated, last_synced_at)
    SELECT 'opencode:session', last_time_updated, last_synced_at
    FROM ingestion_cursor
    WHERE source = 'opencode_session'
    ON CONFLICT(source) DO UPDATE SET
      last_time_updated = MAX(ingestion_cursor.last_time_updated, excluded.last_time_updated),
      last_synced_at = MAX(ingestion_cursor.last_synced_at, excluded.last_synced_at);

    INSERT INTO ingestion_cursor (source, last_time_updated, last_synced_at)
    SELECT 'opencode:message', last_time_updated, last_synced_at
    FROM ingestion_cursor
    WHERE source = 'opencode_message'
    ON CONFLICT(source) DO UPDATE SET
      last_time_updated = MAX(ingestion_cursor.last_time_updated, excluded.last_time_updated),
      last_synced_at = MAX(ingestion_cursor.last_synced_at, excluded.last_synced_at);

    DELETE FROM ingestion_cursor WHERE source IN ('opencode_session', 'opencode_message');
  `);
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
