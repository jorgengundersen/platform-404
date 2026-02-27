import { Database } from "bun:sqlite";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import * as fs from "node:fs";

import { statsOverviewHandler } from "@/api/stats";
import { openDashboardDb } from "@/services/dashboard-db";
import { ingestOnce } from "@/services/ingestion";
import { openSourceDb } from "@/services/source-db";

describe("GET /api/stats/overview", () => {
  let tempDbPath: string;

  beforeAll(() => {
    tempDbPath = `/tmp/test-stats-${Date.now()}.db`;
  });

  afterAll(() => {
    if (fs.existsSync(tempDbPath)) {
      fs.unlinkSync(tempDbPath);
    }
  });

  test("returns 200 with JSON { data: { totalSessions: number } }", async () => {
    // Setup: create temp dashboard with test data
    const db = openDashboardDb(tempDbPath);

    // Insert test sessions
    const insertStmt = db.prepare(
      "INSERT INTO sessions (id, project_id, title, time_updated) VALUES (?, ?, ?, ?)",
    );
    insertStmt.run("session-1", "proj-1", "Test Session 1", Date.now());
    insertStmt.run("session-2", "proj-1", "Test Session 2", Date.now());
    insertStmt.run("session-3", "proj-2", "Test Session 3", Date.now());

    db.close();

    // Create request and get response
    const req = new Request("http://localhost:3000/api/stats/overview", {
      method: "GET",
    });

    const response = await statsOverviewHandler(req, tempDbPath);

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({
      data: {
        totalSessions: 3,
      },
    });
  });

  test("counts distinct session ids with duplicate ids in malformed schema", async () => {
    // Setup: create temp DB with malformed schema (no PK on id)
    const tempMalformedDbPath = `/tmp/test-stats-malformed-${Date.now()}.db`;
    const db = new Database(tempMalformedDbPath);

    db.exec(`
      CREATE TABLE sessions (
        id TEXT,
        project_id TEXT,
        title TEXT,
        time_updated INTEGER,
        time_ingested INTEGER
      );
    `);

    // Insert two rows with same id (simulating malformed data)
    const insertStmt = db.prepare(
      "INSERT INTO sessions (id, project_id, title, time_updated, time_ingested) VALUES (?, ?, ?, ?, ?)",
    );
    insertStmt.run("dup-session", "proj-1", "Duplicate Session", 1000, 2000);
    insertStmt.run("dup-session", "proj-1", "Duplicate Session", 1000, 2000);
    insertStmt.run("unique-session", "proj-2", "Unique Session", 1100, 2100);

    db.close();

    // Call statsOverviewHandler
    const req = new Request("http://localhost:3000/api/stats/overview", {
      method: "GET",
    });

    const response = await statsOverviewHandler(req, tempMalformedDbPath);

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({
      data: {
        totalSessions: 2,
      },
    });

    // Cleanup
    if (fs.existsSync(tempMalformedDbPath)) {
      fs.unlinkSync(tempMalformedDbPath);
    }
  });

  test("stats count works correctly after ingestion pipeline populates project_name", async () => {
    // Setup: create temp source database with sessions + projects
    const tempSourceDbPath = `/tmp/test-stats-source-${Date.now()}.db`;
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
        ('sess-alpha', 'proj-10', 'Session Alpha', 1000),
        ('sess-beta', 'proj-10', 'Session Beta', 2000),
        ('sess-gamma', 'proj-20', 'Session Gamma', 3000);
      INSERT INTO project (id, name) VALUES
        ('proj-10', 'Project X'),
        ('proj-20', 'Project Y');
    `);
    sourceDb.close();

    // Create temp dashboard database
    const tempDashboardDbPath = `/tmp/test-stats-dashboard-${Date.now()}.db`;

    try {
      // Run ingestion pipeline: this should populate project_name
      const sourceDb2 = openSourceDb(tempSourceDbPath);
      const dashboardDb = openDashboardDb(tempDashboardDbPath);

      ingestOnce(sourceDb2, dashboardDb);

      // Verify project_name was populated by checking raw table
      const sessionWithName = dashboardDb
        .query("SELECT id, project_name FROM sessions WHERE id = ?")
        .get("sess-alpha") as {
        id: string;
        project_name: string | null;
      } | null;

      expect(sessionWithName).not.toBeNull();
      expect(sessionWithName?.project_name).toBe("Project X");

      sourceDb2.close();
      dashboardDb.close();

      // Now call stats endpoint and verify count
      const req = new Request("http://localhost:3000/api/stats/overview", {
        method: "GET",
      });

      const response = await statsOverviewHandler(req, tempDashboardDbPath);

      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body).toEqual({
        data: {
          totalSessions: 3,
        },
      });
    } finally {
      // Cleanup
      if (fs.existsSync(tempSourceDbPath)) {
        fs.unlinkSync(tempSourceDbPath);
      }
      if (fs.existsSync(tempDashboardDbPath)) {
        fs.unlinkSync(tempDashboardDbPath);
      }
    }
  });
});
