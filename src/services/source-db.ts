import { Database } from "bun:sqlite";

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
