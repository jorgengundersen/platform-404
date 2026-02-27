import { Database } from "bun:sqlite";

interface SessionRow {
  id: string;
  project_id: string;
  title: string;
  time_updated: number;
}

interface ProjectRow {
  id: string;
  name: string;
}

/**
 * openSourceDb - Opens the OpenCode database in read-only mode with PRAGMA query_only=ON
 *
 * @param dbPath - Path to the OpenCode SQLite database
 * @returns Database instance configured for read-only access
 */
export function openSourceDb(dbPath: string): Database {
  const db = new Database(dbPath, { readonly: true });

  // Enable query_only to prevent all write operations
  db.exec("PRAGMA query_only=ON");

  return db;
}

/**
 * listSessionsUpdatedSince - Lists sessions updated after sinceMs
 *
 * @param db - Database instance
 * @param sinceMs - Timestamp in milliseconds; sessions updated after this time are returned
 * @returns Array of sessions ordered by time_updated ascending
 */
export function listSessionsUpdatedSince(
  db: Database,
  sinceMs: number,
): SessionRow[] {
  const query = db.query(
    "SELECT id, project_id, title, time_updated FROM session WHERE time_updated > ? ORDER BY time_updated ASC",
  );
  const rows = query.all(sinceMs) as SessionRow[];
  return rows;
}

/**
 * listProjectsByIds - Lists projects by their IDs
 *
 * @param db - Database instance
 * @param ids - Array of project IDs to fetch
 * @returns Array of projects with { id, name }
 */
export function listProjectsByIds(db: Database, ids: string[]): ProjectRow[] {
  if (ids.length === 0) {
    return [];
  }

  const placeholders = ids.map(() => "?").join(",");
  const query = db.query(
    `SELECT id, name FROM project WHERE id IN (${placeholders})`,
  );
  const rows = query.all(...ids) as ProjectRow[];
  return rows;
}
