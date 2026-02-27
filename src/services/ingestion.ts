import type { Database } from "bun:sqlite";
import {
  listProjectsByIds,
  listSessionsUpdatedSince,
} from "@/services/source-db";

/**
 * ingestOnce - Copies sessions from source database to dashboard database
 * using cursor watermark for idempotent upsert.
 *
 * @param sourceDb - Read-only source database (OpenCode)
 * @param dashboardDb - Target dashboard database
 */
export function ingestOnce(sourceDb: Database, dashboardDb: Database): void {
  // Get the current cursor watermark for this source
  const cursorRow = dashboardDb
    .query("SELECT last_time_updated FROM ingestion_cursor WHERE source = ?")
    .get("opencode_session") as { last_time_updated: number } | null;

  const sinceMs = cursorRow?.last_time_updated ?? -1;

  // Fetch all sessions from source updated since cursor
  const sessions = listSessionsUpdatedSince(sourceDb, sinceMs);

  if (sessions.length === 0) {
    return; // Nothing to ingest
  }

  // Fetch unique project IDs and get their names
  const projectIds = Array.from(new Set(sessions.map((s) => s.project_id)));
  const projects = listProjectsByIds(sourceDb, projectIds);
  const projectNameMap = new Map(projects.map((p) => [p.id, p.name]));

  // Single timestamp for both time_ingested and last_synced_at
  const now = Date.now();

  // Start transaction: upsert sessions, then update cursor
  dashboardDb.exec("BEGIN TRANSACTION");

  try {
    // Upsert sessions into dashboard (idempotent via id primary key)
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

    // Update cursor to latest ingested time (use same timestamp)
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
