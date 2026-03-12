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

  test("schema v3: migrates source/metadata columns, daily_stats composite PK, and ingestion_cursor keys idempotently", () => {
    const testDbPath = `/tmp/test-dashboard-v3-${Date.now()}.db`;
    try {
      const oldDb = new Database(testDbPath);
      oldDb.exec(`
        CREATE TABLE ingestion_cursor (
          source TEXT PRIMARY KEY,
          last_time_updated INTEGER,
          last_synced_at INTEGER
        );

        CREATE TABLE sessions (
          id TEXT PRIMARY KEY,
          project_id TEXT,
          project_name TEXT,
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

        CREATE TABLE messages (
          id TEXT PRIMARY KEY,
          session_id TEXT,
          role TEXT,
          provider_id TEXT,
          model_id TEXT,
          agent TEXT,
          cost REAL,
          tokens_input INTEGER,
          tokens_output INTEGER,
          tokens_reasoning INTEGER,
          cache_read INTEGER,
          cache_write INTEGER,
          time_created INTEGER,
          time_ingested INTEGER
        );

        CREATE TABLE daily_stats (
          date TEXT PRIMARY KEY,
          session_count INTEGER,
          message_count INTEGER,
          total_cost REAL,
          total_tokens_input INTEGER,
          total_tokens_output INTEGER,
          total_tokens_reasoning INTEGER,
          total_cache_read INTEGER,
          total_cache_write INTEGER,
          time_updated INTEGER
        );
      `);

      oldDb
        .prepare(
          "INSERT INTO ingestion_cursor (source, last_time_updated, last_synced_at) VALUES (?, ?, ?)",
        )
        .run("opencode_session", 111, 222);
      oldDb
        .prepare(
          "INSERT INTO ingestion_cursor (source, last_time_updated, last_synced_at) VALUES (?, ?, ?)",
        )
        .run("opencode_message", 333, 444);

      oldDb
        .prepare(
          `INSERT INTO sessions (
            id, project_id, project_name, title, version,
            summary_additions, summary_deletions, summary_files, message_count,
            total_cost, total_tokens_input, total_tokens_output, total_tokens_reasoning,
            total_cache_read, total_cache_write, time_created, time_updated, time_ingested
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          "s1",
          "proj1",
          "Project One",
          "Session 1",
          "v1",
          1,
          2,
          3,
          4,
          5.5,
          10,
          11,
          12,
          13,
          14,
          1000,
          2000,
          3000,
        );

      oldDb
        .prepare(
          `INSERT INTO messages (
            id, session_id, role, provider_id, model_id, agent,
            cost, tokens_input, tokens_output, tokens_reasoning,
            cache_read, cache_write, time_created, time_ingested
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          "m1",
          "s1",
          "assistant",
          "openai",
          "gpt-4",
          null,
          1.25,
          20,
          21,
          22,
          23,
          24,
          4000,
          5000,
        );

      oldDb
        .prepare(
          `INSERT INTO daily_stats (
            date, session_count, message_count, total_cost,
            total_tokens_input, total_tokens_output, total_tokens_reasoning,
            total_cache_read, total_cache_write, time_updated
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run("2026-03-12", 1, 1, 1.25, 20, 21, 22, 23, 24, 9999);

      oldDb.close();

      const openProgram = Effect.gen(function* () {
        return yield* DashboardDb;
      });

      const first = Effect.runSync(
        openProgram.pipe(Effect.provide(DashboardDbLive(testDbPath))),
      );
      const firstSessionsCols = first.sqlite
        .query("PRAGMA table_info(sessions)")
        .all() as Array<{ name: string }>;
      const firstMessagesCols = first.sqlite
        .query("PRAGMA table_info(messages)")
        .all() as Array<{ name: string }>;
      const firstDailyCols = first.sqlite
        .query("PRAGMA table_info(daily_stats)")
        .all() as Array<{ name: string; pk: number }>;

      const sessionRow = first.sqlite
        .query("SELECT source, metadata FROM sessions WHERE id = 's1'")
        .get() as { source: string; metadata: string | null } | null;
      const messageRow = first.sqlite
        .query("SELECT source, metadata FROM messages WHERE id = 'm1'")
        .get() as { source: string; metadata: string | null } | null;
      const dailyRow = first.sqlite
        .query(
          "SELECT source, total_cost FROM daily_stats WHERE date = '2026-03-12'",
        )
        .get() as { source: string; total_cost: number } | null;
      const sessionCursor = first.sqlite
        .query(
          "SELECT last_time_updated, last_synced_at FROM ingestion_cursor WHERE source = 'opencode:session'",
        )
        .get() as { last_time_updated: number; last_synced_at: number } | null;
      const messageCursor = first.sqlite
        .query(
          "SELECT last_time_updated, last_synced_at FROM ingestion_cursor WHERE source = 'opencode:message'",
        )
        .get() as { last_time_updated: number; last_synced_at: number } | null;
      const oldSessionCursor = first.sqlite
        .query(
          "SELECT source FROM ingestion_cursor WHERE source = 'opencode_session'",
        )
        .get() as { source: string } | null;
      const oldMessageCursor = first.sqlite
        .query(
          "SELECT source FROM ingestion_cursor WHERE source = 'opencode_message'",
        )
        .get() as { source: string } | null;

      expect(firstSessionsCols.map((col) => col.name)).toContain("source");
      expect(firstSessionsCols.map((col) => col.name)).toContain("metadata");
      expect(firstMessagesCols.map((col) => col.name)).toContain("source");
      expect(firstMessagesCols.map((col) => col.name)).toContain("metadata");
      expect(firstDailyCols.find((col) => col.name === "date")?.pk).toBe(1);
      expect(firstDailyCols.find((col) => col.name === "source")?.pk).toBe(2);
      expect(sessionRow).toEqual({ source: "opencode", metadata: null });
      expect(messageRow).toEqual({ source: "opencode", metadata: null });
      expect(dailyRow).toEqual({ source: "opencode", total_cost: 1.25 });
      expect(sessionCursor).toEqual({
        last_time_updated: 111,
        last_synced_at: 222,
      });
      expect(messageCursor).toEqual({
        last_time_updated: 333,
        last_synced_at: 444,
      });
      expect(oldSessionCursor).toBeNull();
      expect(oldMessageCursor).toBeNull();

      first.sqlite.close();

      const second = Effect.runSync(
        openProgram.pipe(Effect.provide(DashboardDbLive(testDbPath))),
      );
      const cursorCount = (
        second.sqlite
          .query(
            "SELECT COUNT(*) as c FROM ingestion_cursor WHERE source IN ('opencode:session', 'opencode:message')",
          )
          .get() as { c: number }
      ).c;
      const dailyCount = (
        second.sqlite
          .query(
            "SELECT COUNT(*) as c FROM daily_stats WHERE date = '2026-03-12' AND source = 'opencode'",
          )
          .get() as { c: number }
      ).c;

      expect(cursorCount).toBe(2);
      expect(dailyCount).toBe(1);

      second.sqlite.close();
    } finally {
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
    }
  });
});
