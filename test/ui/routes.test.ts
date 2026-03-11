import { describe, expect, test } from "bun:test";

import { Effect, Layer } from "effect";

import type { DashboardRangeQueryParam } from "@/primitives/schemas/api-params";
import { DashboardDb, DashboardDbTest } from "@/services/dashboard-db";
import { StatsService, StatsServiceLive } from "@/services/stats";
import { rootHandler } from "@/ui/routes";

const TestLayer = Layer.mergeAll(
  DashboardDbTest,
  Layer.provide(StatsServiceLive, DashboardDbTest),
);

describe("GET /", () => {
  test("returns 200 HTML dashboard with overview cards", async () => {
    const program = Effect.gen(function* () {
      const { sqlite } = yield* DashboardDb;
      sqlite
        .prepare(
          `INSERT INTO sessions
            (id, project_id, project_name, title, message_count, total_cost, total_tokens_input,
             total_tokens_output, total_tokens_reasoning, total_cache_read,
             total_cache_write, time_created, time_updated)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          "s1",
          "p1",
          "my-project",
          "Test Session",
          3,
          0.05,
          100,
          200,
          0,
          5,
          10,
          1000,
          2000,
        );

      const req = new Request("http://localhost:3000/");
      const response = yield* rootHandler(req);
      const body = yield* Effect.promise(() => response.text());

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toContain("text/html");
      expect(body).toContain("platform-404");
      expect(body).toContain("overview-cards");
      expect(body).toContain("dashboard");
    });

    await Effect.runPromise(Effect.provide(program, TestLayer));
  });

  test("normalizes invalid range/compare and loads v2 datasets without breaking page", async () => {
    let capturedRange: DashboardRangeQueryParam | undefined;
    let capturedCompare: boolean | undefined;

    const program = Effect.gen(function* () {
      const req = new Request("http://localhost:3000/?range=oops&compare=nope");
      const response = yield* rootHandler(req);
      const body = yield* Effect.promise(() => response.text());

      expect(response.status).toBe(200);
      expect(body).toContain("Recent Sessions");
    });

    const StatsLayer = Layer.succeed(StatsService, {
      getOverview: () =>
        Effect.succeed({
          totalSessions: 0,
          totalMessages: 0,
          totalCost: 0,
          totalTokensInput: 0,
          totalTokensOutput: 0,
          totalTokensReasoning: 0,
          totalCacheRead: 0,
          totalCacheWrite: 0,
          avgCostPerSession: 0,
          avgMessagesPerSession: 0,
        }),
      getDailyStats: () => Effect.succeed([]),
      getKpiSummary: ({
        range,
        compare,
      }: {
        range: DashboardRangeQueryParam;
        compare: boolean;
      }) => {
        capturedRange = range;
        capturedCompare = compare;
        return Effect.fail({ reason: "boom" } as never);
      },
      getTrendSeries: () => Effect.fail({ reason: "boom" } as never),
      getProjectCostShare: () => Effect.fail({ reason: "boom" } as never),
      getModelCostShare: () => Effect.fail({ reason: "boom" } as never),
      getAnomalies: () => Effect.fail({ reason: "boom" } as never),
      getExpensiveSessions: () => Effect.fail({ reason: "boom" } as never),
      getModelBreakdown: () => Effect.succeed([]),
      getProjectBreakdown: () => Effect.succeed([]),
      getSessionsForDate: () => Effect.succeed([]),
      getSessions: () => Effect.succeed([]),
    });

    await Effect.runPromise(
      Effect.provide(program, Layer.mergeAll(DashboardDbTest, StatsLayer)),
    );
    expect(capturedRange).toBe("30d");
    expect(capturedCompare).toBe(true);
  });
});
