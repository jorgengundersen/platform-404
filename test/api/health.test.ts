import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import * as fs from "node:fs";

import { healthHandler } from "@/api/health";
import { openDashboardDb } from "@/services/dashboard-db";

describe("GET /api/health", () => {
  let tempDbPath: string;

  beforeAll(() => {
    tempDbPath = `/tmp/test-health-${Date.now()}.db`;
  });

  afterAll(() => {
    if (fs.existsSync(tempDbPath)) {
      fs.unlinkSync(tempDbPath);
    }
  });

  test("returns 200 with JSON { data: { status: 'ok' } }", async () => {
    const db = openDashboardDb(tempDbPath);
    db.close();

    const req = new Request("http://localhost:3000/api/health", {
      method: "GET",
    });
    const response = await healthHandler(req, tempDbPath);

    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      data: { status: string; lastSync: number | null };
    };
    expect(body).toEqual({
      data: {
        status: "ok",
        lastSync: null,
      },
    });
  });

  test("includes lastSync: number | null in response", async () => {
    // Setup: create temp database with sync data
    const db = openDashboardDb(tempDbPath);
    const now = Date.now();
    const cursorStmt = db.prepare(
      "INSERT INTO ingestion_cursor (source, last_time_updated, last_synced_at) VALUES (?, ?, ?)",
    );
    cursorStmt.run("opencode_session", now, now);
    db.close();

    const req = new Request("http://localhost:3000/api/health", {
      method: "GET",
    });
    const response = await healthHandler(req, tempDbPath);

    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      data: { status: string; lastSync: number | null };
    };
    expect(body.data).toHaveProperty("lastSync");
    expect(
      typeof body.data.lastSync === "number" || body.data.lastSync === null,
    ).toBe(true);
    expect(body.data.lastSync).toBe(now);
  });
});
