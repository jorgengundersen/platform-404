import { Database } from "bun:sqlite";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import * as fs from "node:fs";

import { openSourceDb } from "@/services/source-db";

describe("openSourceDb", () => {
  let tempDbPath: string;

  beforeAll(() => {
    // Create a temp directory and minimal test database
    tempDbPath = `/tmp/test-opencode-${Date.now()}.db`;

    // Create a minimal OpenCode database with sessions table
    const db = new Database(tempDbPath);
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY,
        project_id INTEGER,
        title TEXT,
        time_updated INTEGER
      );
      INSERT INTO sessions (id, project_id, title, time_updated) VALUES
        (1, 100, 'Test Session 1', 1000000),
        (2, 101, 'Test Session 2', 1000001);
    `);
    db.close();
  });

  afterAll(() => {
    if (fs.existsSync(tempDbPath)) {
      fs.unlinkSync(tempDbPath);
    }
  });

  test("opens database readonly with query_only=ON and blocks writes even when pragma disabled", () => {
    const db = openSourceDb(tempDbPath);

    // Verify query_only is set
    const queryOnlyResult = db.query("PRAGMA query_only").get() as {
      query_only: number;
    };
    expect(queryOnlyResult.query_only).toBe(1);

    // Verify we can query
    const sessionsResult = db
      .query("SELECT COUNT(*) as count FROM sessions")
      .get() as { count: number };
    expect(sessionsResult.count).toBe(2);

    // Try to disable query_only and verify write still fails due to readonly flag
    db.exec("PRAGMA query_only=OFF");
    expect(() => {
      db.exec(
        "INSERT INTO sessions (id, project_id, title, time_updated) VALUES (999, 999, 'Fail', 999)",
      );
    }).toThrow();

    db.close();
  });
});
