import { Database } from "bun:sqlite";

const DEFAULT_DASHBOARD_DB_PATH = "/data/dashboard.db";

/**
 * openDashboardDb - Opens the dashboard database and runs migrations
 *
 * @param dbPath - Path to the dashboard SQLite database (defaults to /data/dashboard.db)
 * @returns Database instance
 */
export function openDashboardDb(dbPath?: string): Database {
  const path = dbPath ?? DEFAULT_DASHBOARD_DB_PATH;
  const db = new Database(path);

  ensureMigrations(db);

  return db;
}

/**
 * ensureMigrations - Creates required tables if they don't exist
 * Schema matches architecture.md specifications
 *
 * @param db - Database instance
 */
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
  `);
}
