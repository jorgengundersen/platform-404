import { Database } from "bun:sqlite";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import * as fs from "node:fs";

import { Effect, Layer } from "effect";
import { SourceDbLive } from "@/adapters/opencode/source-db";
import { DashboardDb, DashboardDbTest } from "@/services/dashboard-db";
import { IngestionService, IngestionServiceLive } from "@/services/ingestion";

describe("IngestionService preserves time_created from source sessions", () => {
  let tempSourceDbPath: string;

  beforeAll(() => {
    tempSourceDbPath = `/tmp/test-source-time-created-${Date.now()}.db`;
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
      INSERT INTO session VALUES ('s1', 'p1', 'Session One', 1000000, 2000000);
    `);
    db.close();
  });

  afterAll(() => {
    if (fs.existsSync(tempSourceDbPath)) {
      fs.unlinkSync(tempSourceDbPath);
    }
  });

  const makeLayer = (sourcePath: string) => {
    const base = Layer.merge(SourceDbLive(sourcePath), DashboardDbTest);
    return IngestionServiceLive.pipe(Layer.provide(base)).pipe(
      Layer.provideMerge(base),
    );
  };

  test("ingested session has time_created matching source session", async () => {
    const program = Effect.gen(function* () {
      const svc = yield* IngestionService;
      const { sqlite } = yield* DashboardDb;

      yield* svc.ingestOnce;

      const row = sqlite
        .query("SELECT time_created FROM sessions WHERE id = 's1'")
        .get() as { time_created: number } | null;

      return { timeCreated: row?.time_created };
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(makeLayer(tempSourceDbPath))),
    );

    expect(result.timeCreated).toBe(1000000);
  });
});
