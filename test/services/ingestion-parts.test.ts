import { Database } from "bun:sqlite";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import * as fs from "node:fs";

import { Effect, Layer } from "effect";

import { DashboardDb, DashboardDbTest } from "@/services/dashboard-db";
import { IngestionService, IngestionServiceLive } from "@/services/ingestion";
import { SourceDbLive } from "@/services/source-db";

describe("IngestionService step-finish parts", () => {
  let tempSourceDbPath: string;

  beforeAll(() => {
    tempSourceDbPath = `/tmp/test-source-parts-${Date.now()}.db`;
    const db = new Database(tempSourceDbPath);
    // Assistant message has zero tokens in the message data,
    // but two step-finish parts with real token data.
    // Ingestion should sum the parts and use that for session aggregates.
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

      INSERT INTO project VALUES ('p1', 'Parts Project');
      INSERT INTO session VALUES ('s1', 'p1', 'Parts Session', 1000, 2000);

      INSERT INTO message VALUES (
        'm1', 's1',
        '{"role":"assistant","modelID":"claude-3-5-sonnet","providerID":"anthropic","cost":0,"tokens":{"input":0,"output":0,"reasoning":0,"cacheRead":0,"cacheWrite":0}}',
        1000, 1001
      );

      INSERT INTO part VALUES (
        'pt1', 'm1', 's1',
        '{"type":"step-finish","cost":0.03,"tokens":{"input":200,"output":80,"reasoning":5,"cacheRead":20,"cacheWrite":10}}',
        1000, 1001
      );
      INSERT INTO part VALUES (
        'pt2', 'm1', 's1',
        '{"type":"step-finish","cost":0.02,"tokens":{"input":100,"output":40,"reasoning":0,"cacheRead":10,"cacheWrite":5}}',
        1200, 1201
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

  test("session aggregates use step-finish part totals when message data has zero tokens", async () => {
    const program = Effect.gen(function* () {
      const svc = yield* IngestionService;
      yield* svc.ingestOnce;

      const { sqlite } = yield* DashboardDb;

      const session = sqlite
        .query("SELECT * FROM sessions WHERE id = 's1'")
        .get() as {
        total_cost: number;
        total_tokens_input: number;
        total_tokens_output: number;
        total_tokens_reasoning: number;
        total_cache_read: number;
        total_cache_write: number;
      } | null;

      return session;
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(makeTestLayer(tempSourceDbPath))),
    );

    expect(result).not.toBeNull();
    if (!result) return;
    // pt1 + pt2 totals
    expect(result.total_cost).toBeCloseTo(0.05);
    expect(result.total_tokens_input).toBe(300);
    expect(result.total_tokens_output).toBe(120);
    expect(result.total_tokens_reasoning).toBe(5);
    expect(result.total_cache_read).toBe(30);
    expect(result.total_cache_write).toBe(15);
  });
});
