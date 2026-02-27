import { Database } from "bun:sqlite";

const DEFAULT_DASHBOARD_DB_PATH = "/data/dashboard.db";
const DASHBOARD_DB_PATH_ENV = "DASHBOARD_DB_PATH";

/**
 * openDashboardDb - Opens the dashboard database and runs migrations
 *
 * @param dbPath - Path to the dashboard SQLite database (defaults to /data/dashboard.db)
 * @returns Database instance
 */
export function openDashboardDb(dbPath?: string): Database {
  const fromEnv = process.env[DASHBOARD_DB_PATH_ENV];
  const envPath = fromEnv?.trim();
  const path =
    dbPath ??
    (envPath && envPath.length > 0 ? envPath : undefined) ??
    DEFAULT_DASHBOARD_DB_PATH;
  const db = new Database(path);

  ensureMigrations(db);

  return db;
}

/**
 * ensureMigrations - Creates required tables if they don't exist and runs v2 migration
 * Schema matches architecture.md specifications
 *
 * @param db - Database instance
 */
function ensureMigrations(db: Database): void {
  // Create base tables
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
  `);

  // Migrate sessions table v1 -> v2
  migrateSessionsTableV2(db);
}

function migrateSessionsTableV2(db: Database): void {
  // Check if sessions table exists
  const sessionsExists = db
    .query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'",
    )
    .get() as { name: string } | null;

  if (!sessionsExists) {
    return;
  }

  // Get current columns
  const columns = db.query("PRAGMA table_info(sessions)").all() as Array<{
    name: string;
    type: string;
  }>;

  const columnNames = columns.map((c) => c.name);
  const idColumn = columns.find((c) => c.name === "id");
  const hasProjectName = columnNames.includes("project_name");

  // Check if migration needed: id is INTEGER or project_name missing
  const needsRebuild = idColumn?.type !== "TEXT";

  if (needsRebuild) {
    // Rebuild table: rename old, create new, copy data with id cast to TEXT
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
    // Only add missing project_name column
    db.exec(`
      ALTER TABLE sessions ADD COLUMN project_name TEXT;
    `);
  }
}
