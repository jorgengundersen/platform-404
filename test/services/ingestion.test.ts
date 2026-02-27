import { Database } from "bun:sqlite";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import { openDashboardDb } from "@/services/dashboard-db";
import { ingestOnce } from "@/services/ingestion";
import { openSourceDb } from "@/services/source-db";

describe("IngestionService.ingestOnce", () => {
  let tempSourceDbPath: string;
  let tempDashboardDbPath: string;

  beforeAll(() => {
    // Create temp source database with sessions
    tempSourceDbPath = `/tmp/test-source-ingestion-${Date.now()}.db`;
    const sourceDb = new Database(tempSourceDbPath);
    sourceDb.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY,
        project_id INTEGER,
        title TEXT,
        time_updated INTEGER
      );
      INSERT INTO sessions (id, project_id, title, time_updated) VALUES
        (1, 100, 'Session 1', 1000),
        (2, 101, 'Session 2', 2000),
        (3, 102, 'Session 3', 3000);
    `);
    sourceDb.close();

    // Create temp dashboard database
    tempDashboardDbPath = `/tmp/test-dashboard-ingestion-${Date.now()}.db`;
  });

  afterAll(() => {
    if (fs.existsSync(tempSourceDbPath)) {
      fs.unlinkSync(tempSourceDbPath);
    }
    if (fs.existsSync(tempDashboardDbPath)) {
      fs.unlinkSync(tempDashboardDbPath);
    }
  });

  test("ingestOnce copies sessions + idempotent upsert with cursor watermark", () => {
    const sourceDb = openSourceDb(tempSourceDbPath);
    const dashboardDb = openDashboardDb(tempDashboardDbPath);

    // First ingest: copy all sessions, update cursor
    ingestOnce(sourceDb, dashboardDb);

    // Verify sessions were copied
    const sessions = dashboardDb
      .query(
        "SELECT id, project_id, title, time_updated FROM sessions ORDER BY time_updated ASC",
      )
      .all() as Array<{
      id: string;
      project_id: string;
      title: string;
      time_updated: number;
    }>;

    expect(sessions).toHaveLength(3);
    expect(sessions[0]?.title).toBe("Session 1");
    expect(sessions[0]?.time_updated).toBe(1000);
    expect(sessions[1]?.title).toBe("Session 2");
    expect(sessions[2]?.title).toBe("Session 3");

    // Verify cursor was updated
    const cursor = dashboardDb
      .query(
        "SELECT last_time_updated FROM ingestion_cursor WHERE source = 'opencode_session'",
      )
      .get() as { last_time_updated: number } | null;

    expect(cursor).not.toBeNull();
    expect(cursor?.last_time_updated).toBe(3000);

    // Second ingest with same data - verify idempotent
    ingestOnce(sourceDb, dashboardDb);

    // Verify no duplicates (still 3 sessions)
    const sessionCount = dashboardDb
      .query("SELECT COUNT(*) as count FROM sessions")
      .get() as { count: number };

    expect(sessionCount.count).toBe(3);

    sourceDb.close();
    dashboardDb.close();
  });
});
