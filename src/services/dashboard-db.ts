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
 *
 * @param db - Database instance
 */
function ensureMigrations(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ingestion_cursor (
      id INTEGER PRIMARY KEY,
      source_id TEXT NOT NULL UNIQUE,
      cursor_value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY,
      session_id TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
}
