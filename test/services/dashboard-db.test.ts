import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import * as fs from "node:fs";

import { openDashboardDb } from "@/services/dashboard-db";

describe("openDashboardDb", () => {
  let tempDbPath: string;

  beforeAll(() => {
    tempDbPath = `/tmp/test-dashboard-${Date.now()}.db`;
  });

  afterAll(() => {
    if (fs.existsSync(tempDbPath)) {
      fs.unlinkSync(tempDbPath);
    }
  });

  test("creates tables ingestion_cursor and sessions with migrations", () => {
    const db = openDashboardDb(tempDbPath);

    // Query sqlite_master to verify tables exist
    const ingestionCursorTable = db
      .query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='ingestion_cursor'",
      )
      .get() as { name: string } | null;

    const sessionsTable = db
      .query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'",
      )
      .get() as { name: string } | null;

    expect(ingestionCursorTable).not.toBeNull();
    expect(ingestionCursorTable?.name).toBe("ingestion_cursor");

    expect(sessionsTable).not.toBeNull();
    expect(sessionsTable?.name).toBe("sessions");

    db.close();
  });
});
