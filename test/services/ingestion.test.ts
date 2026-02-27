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
    // Create temp source database with sessions and projects
    tempSourceDbPath = `/tmp/test-source-ingestion-${Date.now()}.db`;
    const sourceDb = new Database(tempSourceDbPath);
    sourceDb.exec(`
      CREATE TABLE IF NOT EXISTS session (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        title TEXT,
        time_updated INTEGER
      );
      CREATE TABLE IF NOT EXISTS project (
        id TEXT PRIMARY KEY,
        name TEXT
      );
      INSERT INTO session (id, project_id, title, time_updated) VALUES
        ('sess-1', 'proj-100', 'Session 1', 1000),
        ('sess-2', 'proj-101', 'Session 2', 2000),
        ('sess-3', 'proj-102', 'Session 3', 3000);
      INSERT INTO project (id, name) VALUES
        ('proj-100', 'Project Alpha'),
        ('proj-101', 'Project Beta'),
        ('proj-102', 'Project Gamma');
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
        "SELECT id, project_id, project_name, title, time_updated FROM sessions ORDER BY time_updated ASC",
      )
      .all() as Array<{
      id: string;
      project_id: string;
      project_name: string;
      title: string;
      time_updated: number;
    }>;

    expect(sessions).toHaveLength(3);
    expect(sessions[0]?.id).toBe("sess-1");
    expect(sessions[0]?.title).toBe("Session 1");
    expect(sessions[0]?.time_updated).toBe(1000);
    expect(sessions[0]?.project_name).toBe("Project Alpha");
    expect(sessions[1]?.id).toBe("sess-2");
    expect(sessions[1]?.title).toBe("Session 2");
    expect(sessions[1]?.project_name).toBe("Project Beta");
    expect(sessions[2]?.id).toBe("sess-3");
    expect(sessions[2]?.title).toBe("Session 3");
    expect(sessions[2]?.project_name).toBe("Project Gamma");

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

  test("ingestOnce cursor watermark advances correctly when multiple sessions share same time_updated", () => {
    // Setup: Create source db with duplicate time_updated values
    const tempSourceDbPath2 = `/tmp/test-source-dup-${Date.now()}.db`;
    const sourceDb2 = new Database(tempSourceDbPath2);
    sourceDb2.exec(`
      CREATE TABLE IF NOT EXISTS session (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        title TEXT,
        time_updated INTEGER
      );
      CREATE TABLE IF NOT EXISTS project (
        id TEXT PRIMARY KEY,
        name TEXT
      );
      INSERT INTO session (id, project_id, title, time_updated) VALUES
        ('sess-a', 'proj-1', 'Session A', 5000),
        ('sess-b', 'proj-1', 'Session B', 5000),
        ('sess-c', 'proj-1', 'Session C', 5000);
      INSERT INTO project (id, name) VALUES ('proj-1', 'Project One');
    `);
    sourceDb2.close();

    const tempDashboardDbPath2 = `/tmp/test-dashboard-dup-${Date.now()}.db`;
    const sourceDb = openSourceDb(tempSourceDbPath2);
    const dashboardDb = openDashboardDb(tempDashboardDbPath2);

    // First ingest: all 3 sessions with same time_updated
    ingestOnce(sourceDb, dashboardDb);

    let sessionCount = dashboardDb
      .query("SELECT COUNT(*) as count FROM sessions")
      .get() as { count: number };
    expect(sessionCount.count).toBe(3);

    // Manually insert time_ingested value for first batch to detect re-ingestion
    const firstIngestionTime = dashboardDb
      .query("SELECT MAX(time_ingested) as max_time FROM sessions")
      .get() as { max_time: number } | null;
    expect(firstIngestionTime?.max_time).not.toBeNull();

    // Second ingest: should not fetch and update any sessions
    // If cursor logic is wrong (using >= instead of >), sessions with time_updated=5000
    // will be fetched again and time_ingested will be updated
    ingestOnce(sourceDb, dashboardDb);

    const secondIngestionTime = dashboardDb
      .query("SELECT MAX(time_ingested) as max_time FROM sessions")
      .get() as { max_time: number } | null;

    sessionCount = dashboardDb
      .query("SELECT COUNT(*) as count FROM sessions")
      .get() as { count: number };
    expect(sessionCount.count).toBe(3);

    // Verify cursor is at 5000
    const cursor = dashboardDb
      .query(
        "SELECT last_time_updated FROM ingestion_cursor WHERE source = 'opencode_session'",
      )
      .get() as { last_time_updated: number } | null;
    expect(cursor?.last_time_updated).toBe(5000);

    // The key assertion: time_ingested should NOT change between runs
    // (no sessions should be re-fetched and re-ingested)
    expect(secondIngestionTime?.max_time).toBe(firstIngestionTime?.max_time);

    sourceDb.close();
    dashboardDb.close();

    // Cleanup
    if (fs.existsSync(tempSourceDbPath2)) {
      fs.unlinkSync(tempSourceDbPath2);
    }
    if (fs.existsSync(tempDashboardDbPath2)) {
      fs.unlinkSync(tempDashboardDbPath2);
    }
  });
});
