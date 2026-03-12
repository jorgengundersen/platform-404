import { Database } from "bun:sqlite";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import { Effect, Layer } from "effect";
import {
  OpenCodeAdapter,
  OpenCodeAdapterLive,
} from "@/adapters/opencode/adapter";
import { SourceDbLive } from "@/adapters/opencode/source-db";
import { DashboardDbTest } from "@/services/dashboard-db";

describe("OpenCodeAdapter", () => {
  let tempSourceDbPath: string;

  beforeAll(() => {
    tempSourceDbPath = `/tmp/test-opencode-adapter-${Date.now()}.db`;
    const db = new Database(tempSourceDbPath);
    db.exec(`
      CREATE TABLE session (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        title TEXT,
        time_created INTEGER,
        time_updated INTEGER
      );
      CREATE TABLE project (id TEXT PRIMARY KEY, name TEXT);
      CREATE TABLE message (
        id TEXT PRIMARY KEY,
        session_id TEXT,
        data TEXT,
        time_created INTEGER,
        time_updated INTEGER
      );
      CREATE TABLE part (
        id TEXT PRIMARY KEY,
        message_id TEXT,
        session_id TEXT,
        data TEXT,
        time_created INTEGER,
        time_updated INTEGER
      );

      INSERT INTO project VALUES ('p1', 'Project One');
      INSERT INTO session VALUES ('s1', 'p1', 'Session One', 1000, 2000);

      INSERT INTO message VALUES (
        'm1', 's1',
        '{"role":"user","agent":"coder","model":{"providerID":"anthropic","modelID":"claude-3-5-sonnet"}}',
        1100, 1200
      );
      INSERT INTO message VALUES (
        'm2', 's1',
        '{"role":"assistant","modelID":"claude-3-5-sonnet","providerID":"anthropic","cost":0.05,"tokens":{"input":100,"output":50,"reasoning":2,"cacheRead":10,"cacheWrite":5},"finish":"stop"}',
        1300, 1800
      );

      INSERT INTO part VALUES (
        'pt1', 'm2', 's1',
        '{"type":"step-finish","cost":0.05,"tokens":{"input":100,"output":50,"reasoning":2,"cacheRead":10,"cacheWrite":5}}',
        1300, 1800
      );
    `);
    db.close();
  });

  afterAll(() => {
    if (fs.existsSync(tempSourceDbPath)) {
      fs.unlinkSync(tempSourceDbPath);
    }
  });

  test("fetchBatch returns normalized OpenCode sessions/messages and both cursor updates", async () => {
    const program = Effect.gen(function* () {
      const adapter = yield* OpenCodeAdapter;
      return yield* adapter.fetchBatch;
    });

    const layer = OpenCodeAdapterLive.pipe(
      Layer.provide(SourceDbLive(tempSourceDbPath)),
      Layer.provide(DashboardDbTest),
    );

    const batch = await Effect.runPromise(program.pipe(Effect.provide(layer)));

    expect(batch).not.toBeNull();
    if (!batch) return;

    expect(batch.source).toBe("opencode");
    expect(batch.sessions).toHaveLength(1);
    expect(batch.messages).toHaveLength(2);
    expect(batch.sessions[0]?.totalCost).toBeCloseTo(0.05);
    expect(batch.sessions[0]?.totalTokensInput).toBe(100);
    expect(batch.sessions[0]?.messageCount).toBe(2);
    expect(batch.cursorKey).toBe("opencode:session");
    expect(batch.cursorValue).toBe(2000);
    expect(batch.cursorUpdates).toEqual([
      { key: "opencode:session", value: 2000 },
      { key: "opencode:message", value: 1800 },
    ]);
  });
});
