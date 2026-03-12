import { describe, expect, test } from "bun:test";

import { Effect, Layer } from "effect";
import type { NormalizedBatch } from "@/primitives/schemas/normalized-batch";
import { DashboardDb, DashboardDbTest } from "@/services/dashboard-db";
import {
  IngestionService,
  makeIngestionServiceLive,
} from "@/services/ingestion";
import {
  SourceAdapterError,
  type SourceAdapter,
} from "@/services/source-adapter";

function makeStubAdapter(
  source: string,
  batch: NormalizedBatch | null,
): SourceAdapter & { callCount: number } {
  let callCount = 0;
  return {
    source,
    get callCount() {
      return callCount;
    },
    fetchBatch: Effect.sync(() => {
      callCount += 1;
      return batch;
    }),
  };
}

describe("makeIngestionServiceLive - multi-adapter", () => {
  test("calls fetchBatch on all adapters and writes both batches", async () => {
    const now = Date.now();

    const batch1: NormalizedBatch = {
      source: "source_a",
      sessions: [
        {
          id: "s1",
          source: "source_a",
          projectId: null,
          projectName: null,
          title: null,
          messageCount: 0,
          totalCost: 0,
          totalTokensInput: 0,
          totalTokensOutput: 0,
          totalTokensReasoning: 0,
          totalCacheRead: 0,
          totalCacheWrite: 0,
          timeCreated: now,
          timeUpdated: now,
          metadata: null,
        },
      ],
      messages: [],
      cursorKey: "source_a:session",
      cursorValue: now,
      cursorUpdates: [],
    };

    const batch2: NormalizedBatch = {
      source: "source_b",
      sessions: [
        {
          id: "s2",
          source: "source_b",
          projectId: null,
          projectName: null,
          title: null,
          messageCount: 0,
          totalCost: 0,
          totalTokensInput: 0,
          totalTokensOutput: 0,
          totalTokensReasoning: 0,
          totalCacheRead: 0,
          totalCacheWrite: 0,
          timeCreated: now,
          timeUpdated: now,
          metadata: null,
        },
      ],
      messages: [],
      cursorKey: "source_b:session",
      cursorValue: now,
      cursorUpdates: [],
    };

    const adapterA = makeStubAdapter("source_a", batch1);
    const adapterB = makeStubAdapter("source_b", batch2);

    const layer = makeIngestionServiceLive([adapterA, adapterB]).pipe(
      Layer.provideMerge(DashboardDbTest),
    );

    const program = Effect.gen(function* () {
      const svc = yield* IngestionService;
      const { sqlite } = yield* DashboardDb;

      yield* svc.ingestOnce;

      const sessions = sqlite
        .query("SELECT id, source FROM sessions ORDER BY id")
        .all() as Array<{ id: string; source: string }>;

      return { sessions, callA: adapterA.callCount, callB: adapterB.callCount };
    });

    const result = await Effect.runPromise(program.pipe(Effect.provide(layer)));

    expect(result.callA).toBe(1);
    expect(result.callB).toBe(1);
    expect(result.sessions).toHaveLength(2);
    expect(result.sessions[0]).toMatchObject({ id: "s1", source: "source_a" });
    expect(result.sessions[1]).toMatchObject({ id: "s2", source: "source_b" });
  });

  test("adapter returning null does not write and does not fail", async () => {
    const adapterNull = makeStubAdapter("source_null", null);

    const layer = makeIngestionServiceLive([adapterNull]).pipe(
      Layer.provideMerge(DashboardDbTest),
    );

    const program = Effect.gen(function* () {
      const svc = yield* IngestionService;
      const { sqlite } = yield* DashboardDb;

      yield* svc.ingestOnce;

      const count = (
        sqlite.query("SELECT COUNT(*) as c FROM sessions").get() as {
          c: number;
        }
      ).c;
      return { count, calls: adapterNull.callCount };
    });

    const result = await Effect.runPromise(program.pipe(Effect.provide(layer)));

    expect(result.calls).toBe(1);
    expect(result.count).toBe(0);
  });

  test("adapter error is caught and does not stop other adapters", async () => {
    const now = Date.now();

    const adapterFail: SourceAdapter = {
      source: "source_fail",
      fetchBatch: Effect.fail(new SourceAdapterError({ reason: "test error" })),
    };

    const batch: NormalizedBatch = {
      source: "source_ok",
      sessions: [
        {
          id: "s_ok",
          source: "source_ok",
          projectId: null,
          projectName: null,
          title: null,
          messageCount: 0,
          totalCost: 0,
          totalTokensInput: 0,
          totalTokensOutput: 0,
          totalTokensReasoning: 0,
          totalCacheRead: 0,
          totalCacheWrite: 0,
          timeCreated: now,
          timeUpdated: now,
          metadata: null,
        },
      ],
      messages: [],
      cursorKey: "source_ok:session",
      cursorValue: now,
      cursorUpdates: [],
    };

    const adapterOk = makeStubAdapter("source_ok", batch);

    const layer = makeIngestionServiceLive([adapterFail, adapterOk]).pipe(
      Layer.provideMerge(DashboardDbTest),
    );

    const program = Effect.gen(function* () {
      const svc = yield* IngestionService;
      const { sqlite } = yield* DashboardDb;

      yield* svc.ingestOnce;

      const sessions = sqlite.query("SELECT id FROM sessions").all() as Array<{
        id: string;
      }>;

      return { sessions };
    });

    const result = await Effect.runPromise(program.pipe(Effect.provide(layer)));

    // The failing adapter's error is swallowed, ok adapter still runs
    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0]).toMatchObject({ id: "s_ok" });
  });
});
