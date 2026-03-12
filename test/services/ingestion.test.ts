import { Database } from "bun:sqlite";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import * as fs from "node:fs";

import { Effect, Layer } from "effect";
import { SourceDbLive } from "@/adapters/opencode/source-db";
import { DashboardDb, DashboardDbTest } from "@/services/dashboard-db";
import { IngestionService, IngestionServiceLive } from "@/services/ingestion";

describe("IngestionService cursor watermark", () => {
  let tempSourceDbPath: string;

  beforeAll(() => {
    tempSourceDbPath = `/tmp/test-source-cursor-${Date.now()}.db`;
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
      INSERT INTO session VALUES ('sa', 'p1', 'Session A', 5000, 5000);
      INSERT INTO session VALUES ('sb', 'p1', 'Session B', 5000, 5000);
      INSERT INTO session VALUES ('sc', 'p1', 'Session C', 5000, 5000);
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

  test("cursor advances to max time_updated; second ingest does not re-fetch identical sessions", async () => {
    const program = Effect.gen(function* () {
      const svc = yield* IngestionService;
      const { sqlite } = yield* DashboardDb;

      // First ingest
      yield* svc.ingestOnce;

      const countAfterFirst = (
        sqlite.query("SELECT COUNT(*) as c FROM sessions").get() as {
          c: number;
        }
      ).c;
      const firstIngestionMax = (
        sqlite.query("SELECT MAX(time_ingested) as m FROM sessions").get() as {
          m: number;
        }
      ).m;
      const cursor = sqlite
        .query(
          "SELECT last_time_updated FROM ingestion_cursor WHERE source = 'opencode:session'",
        )
        .get() as { last_time_updated: number } | null;

      // Second ingest: cursor is at 5000, sessions have time_updated=5000 so > 5000 = none fetched
      yield* svc.ingestOnce;

      const countAfterSecond = (
        sqlite.query("SELECT COUNT(*) as c FROM sessions").get() as {
          c: number;
        }
      ).c;
      const secondIngestionMax = (
        sqlite.query("SELECT MAX(time_ingested) as m FROM sessions").get() as {
          m: number;
        }
      ).m;

      return {
        countAfterFirst,
        countAfterSecond,
        cursorTime: cursor?.last_time_updated,
        firstIngestionMax,
        secondIngestionMax,
      };
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(makeLayer(tempSourceDbPath))),
    );

    expect(result.countAfterFirst).toBe(3);
    expect(result.countAfterSecond).toBe(3);
    expect(result.cursorTime).toBe(5000);
    // Second ingest fetched nothing new, so time_ingested unchanged
    expect(result.secondIngestionMax).toBe(result.firstIngestionMax);
  });
});
