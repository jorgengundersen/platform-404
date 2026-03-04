import { describe, expect, test } from "bun:test";

import { Effect, Layer } from "effect";

import { DashboardDb, DashboardDbTest } from "@/services/dashboard-db";
import { StatsServiceLive } from "@/services/stats";
import { dailyDetailPageHandler } from "@/ui/routes";

const TestLayer = Layer.mergeAll(
  DashboardDbTest,
  Layer.provide(StatsServiceLive, DashboardDbTest),
);

describe("GET /daily/:date", () => {
  test("returns 400 for invalid date format", async () => {
    const req = new Request("http://localhost:3000/daily/not-a-date");
    const response = await Effect.runPromise(
      dailyDetailPageHandler(req, "not-a-date").pipe(Effect.provide(TestLayer)),
    );
    expect(response.status).toBe(400);
  });

  test("returns 200 HTML page for valid date with session data", async () => {
    // 2026-03-04 00:00:00 UTC = 1772582400000 ms
    const march4Utc = 1772582400000;

    const program = Effect.gen(function* () {
      const { sqlite } = yield* DashboardDb;
      sqlite
        .prepare(
          `INSERT INTO sessions
            (id, project_id, project_name, title, message_count, total_cost,
             total_tokens_input, total_tokens_output, total_tokens_reasoning,
             total_cache_read, total_cache_write, time_created, time_updated)
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
          march4Utc + 1000,
          march4Utc + 2000,
        );

      const req = new Request("http://localhost:3000/daily/2026-03-04");
      return yield* dailyDetailPageHandler(req, "2026-03-04");
    });

    const response = await Effect.runPromise(
      program.pipe(Effect.provide(TestLayer)),
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/html");
    expect(body).toContain("2026-03-04");
    expect(body).toContain("← Dashboard");
    expect(body).toContain("my-project");
  });
});
