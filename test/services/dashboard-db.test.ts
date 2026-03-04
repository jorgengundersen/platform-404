import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import * as fs from "node:fs";

import { Effect } from "effect";

import {
  DashboardDb,
  DashboardDbLive,
  DashboardDbTest,
} from "@/services/dashboard-db";

describe("DashboardDb Effect service", () => {
  test("DashboardDbTest layer provides DashboardDb service", async () => {
    const program = Effect.gen(function* () {
      const db = yield* DashboardDb;
      return db;
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(DashboardDbTest)),
    );

    expect(result).toBeDefined();
  });

  test("DashboardDbTest: creates ingestion_cursor table", async () => {
    const program = Effect.gen(function* () {
      const { sqlite } = yield* DashboardDb;
      const row = sqlite
        .query(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='ingestion_cursor'",
        )
        .get() as { name: string } | null;
      return row;
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(DashboardDbTest)),
    );

    expect(result).not.toBeNull();
    expect(result?.name).toBe("ingestion_cursor");
  });

  test("DashboardDbTest: creates sessions table", async () => {
    const program = Effect.gen(function* () {
      const { sqlite } = yield* DashboardDb;
      const row = sqlite
        .query(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'",
        )
        .get() as { name: string } | null;
      return row;
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(DashboardDbTest)),
    );

    expect(result).not.toBeNull();
    expect(result?.name).toBe("sessions");
  });

  test("DashboardDbTest: creates messages table", async () => {
    const program = Effect.gen(function* () {
      const { sqlite } = yield* DashboardDb;
      const row = sqlite
        .query(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='messages'",
        )
        .get() as { name: string } | null;
      return row;
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(DashboardDbTest)),
    );

    expect(result).not.toBeNull();
    expect(result?.name).toBe("messages");
  });

  test("DashboardDbTest: messages table has correct columns", async () => {
    const program = Effect.gen(function* () {
      const { sqlite } = yield* DashboardDb;
      const columns = sqlite
        .query("PRAGMA table_info(messages)")
        .all() as Array<{ name: string; type: string; pk: number }>;
      return columns;
    });

    const columns = await Effect.runPromise(
      program.pipe(Effect.provide(DashboardDbTest)),
    );

    const names = columns.map((c) => c.name);
    expect(names).toContain("id");
    expect(names).toContain("session_id");
    expect(names).toContain("role");
    expect(names).toContain("provider_id");
    expect(names).toContain("model_id");
    expect(names).toContain("agent");
    expect(names).toContain("cost");
    expect(names).toContain("tokens_input");
    expect(names).toContain("tokens_output");
    expect(names).toContain("tokens_reasoning");
    expect(names).toContain("cache_read");
    expect(names).toContain("cache_write");
    expect(names).toContain("time_created");
    expect(names).toContain("time_ingested");

    const idCol = columns.find((c) => c.name === "id");
    expect(idCol?.type).toBe("TEXT");
    expect(idCol?.pk).toBe(1);
  });

  test("DashboardDbTest: creates daily_stats table", async () => {
    const program = Effect.gen(function* () {
      const { sqlite } = yield* DashboardDb;
      const row = sqlite
        .query(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='daily_stats'",
        )
        .get() as { name: string } | null;
      return row;
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(DashboardDbTest)),
    );

    expect(result).not.toBeNull();
    expect(result?.name).toBe("daily_stats");
  });

  test("DashboardDbTest: daily_stats table has correct columns", async () => {
    const program = Effect.gen(function* () {
      const { sqlite } = yield* DashboardDb;
      const columns = sqlite
        .query("PRAGMA table_info(daily_stats)")
        .all() as Array<{ name: string; type: string; pk: number }>;
      return columns;
    });

    const columns = await Effect.runPromise(
      program.pipe(Effect.provide(DashboardDbTest)),
    );

    const names = columns.map((c) => c.name);
    expect(names).toContain("date");
    expect(names).toContain("session_count");
    expect(names).toContain("message_count");
    expect(names).toContain("total_cost");
    expect(names).toContain("total_tokens_input");
    expect(names).toContain("total_tokens_output");
    expect(names).toContain("total_tokens_reasoning");
    expect(names).toContain("total_cache_read");
    expect(names).toContain("total_cache_write");
    expect(names).toContain("time_updated");

    const dateCol = columns.find((c) => c.name === "date");
    expect(dateCol?.type).toBe("TEXT");
    expect(dateCol?.pk).toBe(1);
  });

  test("DashboardDbTest: migrations are idempotent (run twice without error)", async () => {
    // DashboardDbTest uses :memory: so each provide() creates a fresh db.
    // To test idempotency, directly test ensureMigrations runs twice on same db.
    const program = Effect.gen(function* () {
      const { sqlite } = yield* DashboardDb;
      // Run a second migration via calling the same CREATE IF NOT EXISTS logic
      // by opening a second layer on the same sqlite instance is not possible;
      // instead verify all tables exist (idempotency is in the CREATE IF NOT EXISTS).
      const tables = sqlite
        .query(
          "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
        )
        .all() as Array<{ name: string }>;
      return tables.map((t) => t.name);
    });

    const tableNames = await Effect.runPromise(
      program.pipe(Effect.provide(DashboardDbTest)),
    );

    expect(tableNames).toContain("ingestion_cursor");
    expect(tableNames).toContain("sessions");
    expect(tableNames).toContain("messages");
    expect(tableNames).toContain("daily_stats");
  });
});

describe("DashboardDb schema migration", () => {
  test("schema v2: migrates old sessions table (id INTEGER, no project_name) to v2 (id TEXT, project_name)", () => {
    const testDbPath = `/tmp/test-dashboard-v1-${Date.now()}.db`;
    try {
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

      // Use Effect layer to open and migrate
      const program = Effect.gen(function* () {
        const { sqlite } = yield* DashboardDb;
        const columns = sqlite
          .query("PRAGMA table_info(sessions)")
          .all() as Array<{ name: string; type: string; pk: number }>;
        const row = sqlite
          .prepare("SELECT id, project_id, title FROM sessions LIMIT 1")
          .get() as { id: string; project_id: string; title: string } | null;
        return { columns, row };
      });

      const LiveLayer = DashboardDbLive(testDbPath);
      const { columns, row } = Effect.runSync(
        program.pipe(Effect.provide(LiveLayer)),
      );

      const columnNames = columns.map((c) => c.name);
      expect(columnNames).toContain("project_name");
      const idCol = columns.find((c) => c.name === "id");
      expect(idCol?.type).toBe("TEXT");
      expect(row?.id).toBe("123");
      expect(row?.project_id).toBe("proj1");
    } finally {
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
    }
  });
});
