import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import * as fs from "node:fs";

import { statsOverviewHandler } from "@/api/stats";
import { openDashboardDb } from "@/services/dashboard-db";

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
});
