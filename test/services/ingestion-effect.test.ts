import { Database } from "bun:sqlite";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import * as fs from "node:fs";

import { Effect, Layer } from "effect";

import { DashboardDb, DashboardDbTest } from "@/services/dashboard-db";
import { IngestionService, IngestionServiceLive } from "@/services/ingestion";
import { SourceDbLive } from "@/services/source-db";

describe("IngestionService.ingestOnce (Effect)", () => {
  let tempSourceDbPath: string;

  beforeAll(() => {
    tempSourceDbPath = `/tmp/test-source-ingestion-effect-${Date.now()}.db`;
    const db = new Database(tempSourceDbPath);
    db.exec(`
      CREATE TABLE session (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        title TEXT,
        time_created INTEGER,
        time_updated INTEGER
      );
      CREATE TABLE project (
        id TEXT PRIMARY KEY,
        name TEXT
      );
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

      INSERT INTO project VALUES ('p1', 'Project Alpha');
      INSERT INTO session VALUES ('s1', 'p1', 'Session One', 1000, 2000);

      INSERT INTO message VALUES (
        'm1', 's1',
        '{"role":"user","agent":"coder","model":{"providerID":"anthropic","modelID":"claude-3-5-sonnet"}}',
        1000, 1001
      );
      INSERT INTO message VALUES (
        'm2', 's1',
        '{"role":"assistant","modelID":"claude-3-5-sonnet","providerID":"anthropic","cost":0.05,"tokens":{"input":100,"output":50,"reasoning":0,"cacheRead":10,"cacheWrite":5}}',
        1500, 1501
      );

      INSERT INTO part VALUES (
        'pt1', 'm2', 's1',
        '{"type":"step-finish","cost":0.05,"tokens":{"input":100,"output":50,"reasoning":0,"cacheRead":10,"cacheWrite":5}}',
        1500, 1501
      );
    `);
    db.close();
  });

  afterAll(() => {
    if (fs.existsSync(tempSourceDbPath)) {
      fs.unlinkSync(tempSourceDbPath);
    }
  });

  const makeTestLayer = (sourcePath: string) => {
    const baseDeps = Layer.merge(SourceDbLive(sourcePath), DashboardDbTest);
    return IngestionServiceLive.pipe(Layer.provide(baseDeps)).pipe(
      Layer.provideMerge(baseDeps),
    );
  };

  test("ingestOnce ingests sessions and messages, sets session aggregates", async () => {
    const program = Effect.gen(function* () {
      const svc = yield* IngestionService;
      yield* svc.ingestOnce;

      const { sqlite } = yield* DashboardDb;

      const sessions = sqlite
        .query("SELECT * FROM sessions WHERE id = 's1'")
        .all() as Array<{
        id: string;
        project_name: string;
        message_count: number;
        total_cost: number;
        total_tokens_input: number;
        total_tokens_output: number;
        total_cache_read: number;
        total_cache_write: number;
      }>;

      expect(sessions).toHaveLength(1);
      const session = sessions[0];
      expect(session).toBeDefined();
      if (!session) return;
      expect(session.project_name).toBe("Project Alpha");
      expect(session.message_count).toBe(2);
      expect(session.total_cost).toBeCloseTo(0.05);
      expect(session.total_tokens_input).toBe(100);
      expect(session.total_tokens_output).toBe(50);
      expect(session.total_cache_read).toBe(10);
      expect(session.total_cache_write).toBe(5);

      const messages = sqlite
        .query("SELECT * FROM messages ORDER BY time_created ASC")
        .all() as Array<{
        id: string;
        session_id: string;
        role: string;
        provider_id: string | null;
        model_id: string | null;
        agent: string | null;
        cost: number | null;
        tokens_input: number | null;
        tokens_output: number | null;
      }>;

      expect(messages).toHaveLength(2);
      const userMsg = messages[0];
      const assistantMsg = messages[1];
      expect(userMsg).toBeDefined();
      expect(assistantMsg).toBeDefined();
      if (!userMsg || !assistantMsg) return;
      expect(userMsg.id).toBe("m1");
      expect(userMsg.role).toBe("user");
      expect(userMsg.agent).toBe("coder");
      expect(userMsg.provider_id).toBe("anthropic");
      expect(userMsg.model_id).toBe("claude-3-5-sonnet");

      expect(assistantMsg.id).toBe("m2");
      expect(assistantMsg.role).toBe("assistant");
      expect(assistantMsg.provider_id).toBe("anthropic");
      expect(assistantMsg.model_id).toBe("claude-3-5-sonnet");
      expect(assistantMsg.cost).toBeCloseTo(0.05);
      expect(assistantMsg.tokens_input).toBe(100);
      expect(assistantMsg.tokens_output).toBe(50);
    });

    await Effect.runPromise(
      program.pipe(Effect.provide(makeTestLayer(tempSourceDbPath))),
    );
  });
});
