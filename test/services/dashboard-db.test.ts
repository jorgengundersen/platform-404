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
});
