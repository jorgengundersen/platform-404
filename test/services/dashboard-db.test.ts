import { Database } from "bun:sqlite";
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

  test("schema v1: ingestion_cursor has correct columns and PK", () => {
    const db = openDashboardDb(tempDbPath);

    // Get table info for ingestion_cursor
    const columns = db
      .query("PRAGMA table_info(ingestion_cursor)")
      .all() as Array<{ name: string; type: string; pk: number }>;

    // Verify columns exist
    const columnNames = columns.map((c) => c.name);
    expect(columnNames).toContain("source");
    expect(columnNames).toContain("last_time_updated");
    expect(columnNames).toContain("last_synced_at");

    // Verify source is TEXT and PRIMARY KEY (pk=1)
    const sourceCol = columns.find((c) => c.name === "source");
    expect(sourceCol?.type).toBe("TEXT");
    expect(sourceCol?.pk).toBe(1);

    // Verify other columns are INTEGER
    const lastTimeUpdatedCol = columns.find(
      (c) => c.name === "last_time_updated",
    );
    expect(lastTimeUpdatedCol?.type).toBe("INTEGER");

    const lastSyncedAtCol = columns.find((c) => c.name === "last_synced_at");
    expect(lastSyncedAtCol?.type).toBe("INTEGER");

    db.close();
  });

  test("schema v1: sessions has correct denormalized columns", () => {
    const db = openDashboardDb(tempDbPath);

    const columns = db.query("PRAGMA table_info(sessions)").all() as Array<{
      name: string;
      type: string;
      pk: number;
    }>;

    const columnNames = columns.map((c) => c.name);

    // Verify required columns per spec
    expect(columnNames).toContain("id"); // TEXT PK
    expect(columnNames).toContain("project_id");
    expect(columnNames).toContain("project_name");
    expect(columnNames).toContain("title");
    expect(columnNames).toContain("version");
    expect(columnNames).toContain("summary_additions");
    expect(columnNames).toContain("summary_deletions");
    expect(columnNames).toContain("summary_files");
    expect(columnNames).toContain("message_count");
    expect(columnNames).toContain("total_cost");
    expect(columnNames).toContain("total_tokens_input");
    expect(columnNames).toContain("total_tokens_output");
    expect(columnNames).toContain("total_tokens_reasoning");
    expect(columnNames).toContain("total_cache_read");
    expect(columnNames).toContain("total_cache_write");
    expect(columnNames).toContain("time_created");
    expect(columnNames).toContain("time_updated");
    expect(columnNames).toContain("time_ingested");

    // Verify id is TEXT PRIMARY KEY
    const idCol = columns.find((c) => c.name === "id");
    expect(idCol?.type).toBe("TEXT");
    expect(idCol?.pk).toBe(1);

    db.close();
  });

  test("schema v2: migrates old sessions table (id INTEGER, no project_name) to v2 (id TEXT, project_name)", () => {
    const testDbPath = `/tmp/test-dashboard-v1-${Date.now()}.db`;
    try {
      // Create old v1 schema with id as INTEGER
      const oldDb = new Database(testDbPath);
      oldDb.exec(`
        CREATE TABLE sessions (
          id INTEGER PRIMARY KEY,
          project_id TEXT,
          title TEXT,
          version TEXT,
          summary_additions INTEGER,
          summary_deletions INTEGER,
          summary_files INTEGER,
          message_count INTEGER,
          total_cost REAL,
          total_tokens_input INTEGER,
          total_tokens_output INTEGER,
          total_tokens_reasoning INTEGER,
          total_cache_read INTEGER,
          total_cache_write INTEGER,
          time_created INTEGER,
          time_updated INTEGER,
          time_ingested INTEGER
        );
      `);

      // Insert a row with old schema
      oldDb
        .prepare(`
        INSERT INTO sessions (
          id, project_id, title, version, summary_additions, summary_deletions, 
          summary_files, message_count, total_cost, total_tokens_input, 
          total_tokens_output, total_tokens_reasoning, total_cache_read, 
          total_cache_write, time_created, time_updated, time_ingested
        ) VALUES (123, 'proj1', 'Test', 'v1', 1, 2, 3, 4, 5.0, 6, 7, 8, 9, 10, 11, 12, 13);
      `)
        .run();

      oldDb.close();

      // Open with migration
      const db = openDashboardDb(testDbPath);

      // Verify sessions table has project_name column
      const columns = db.query("PRAGMA table_info(sessions)").all() as Array<{
        name: string;
        type: string;
        pk: number;
      }>;
      const columnNames = columns.map((c) => c.name);
      expect(columnNames).toContain("project_name");

      // Verify id is TEXT
      const idCol = columns.find((c) => c.name === "id");
      expect(idCol?.type).toBe("TEXT");

      // Verify existing row preserved with id as string
      const row = db
        .prepare("SELECT id, project_id, title FROM sessions LIMIT 1")
        .get() as {
        id: string;
        project_id: string;
        title: string;
      } | null;
      expect(row).not.toBeNull();
      expect(row?.id).toBe("123");
      expect(row?.project_id).toBe("proj1");
      expect(row?.title).toBe("Test");

      db.close();
    } finally {
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
    }
  });
});
