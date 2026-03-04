import { describe, expect, test } from "bun:test";

import { Effect, Layer } from "effect";

import { apiDailyDetailHandler } from "@/api/sessions";
import { DashboardDb, DashboardDbTest } from "@/services/dashboard-db";
import { StatsServiceLive } from "@/services/stats";

const TestLayer = Layer.mergeAll(
  DashboardDbTest,
  Layer.provide(StatsServiceLive, DashboardDbTest),
);

function seedSession(
  sqlite: import("bun:sqlite").Database,
  id: string,
  timeCreated: number,
): void {
  sqlite
    .prepare(
      `INSERT INTO sessions
        (id, project_id, project_name, title, message_count, total_cost,
         total_tokens_input, total_tokens_output, total_tokens_reasoning,
         total_cache_read, total_cache_write, time_created, time_updated)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      "p1",
      "My Project",
      `Session ${id}`,
      3,
      0.01,
      100,
      200,
      0,
      5,
      10,
      timeCreated,
      timeCreated + 1000,
    );
}

describe("GET /api/daily/:date", () => {
  test("returns 400 for invalid date format", async () => {
    const req = new Request("http://localhost:3000/api/daily/not-a-date");
    const response = await Effect.runPromise(
      apiDailyDetailHandler(req, "not-a-date").pipe(Effect.provide(TestLayer)),
    );
    expect(response.status).toBe(400);
  });

  test("returns 200 with empty sessions for valid date with no data", async () => {
    const req = new Request("http://localhost:3000/api/daily/2026-01-01");
    const response = await Effect.runPromise(
      apiDailyDetailHandler(req, "2026-01-01").pipe(Effect.provide(TestLayer)),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: { date: string; stat: unknown; sessions: unknown[] };
    };
    expect(body.data.date).toBe("2026-01-01");
    expect(body.data.stat).toBeNull();
    expect(Array.isArray(body.data.sessions)).toBe(true);
    expect(body.data.sessions).toHaveLength(0);
  });

  test("returns sessions for a valid date with matching data", async () => {
    // 2026-03-04 00:00:00 UTC = 1772582400000 ms
    const march4Utc = 1772582400000;

    const program = Effect.gen(function* () {
      const { sqlite } = yield* DashboardDb;
      seedSession(sqlite, "s1", march4Utc + 1000);
      seedSession(sqlite, "s2", march4Utc + 2000);

      const req = new Request("http://localhost:3000/api/daily/2026-03-04");
      return yield* apiDailyDetailHandler(req, "2026-03-04");
    });

    const response = await Effect.runPromise(
      program.pipe(Effect.provide(TestLayer)),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: { date: string; stat: unknown; sessions: unknown[] };
    };
    expect(body.data.date).toBe("2026-03-04");
    expect(Array.isArray(body.data.sessions)).toBe(true);
    expect(body.data.sessions).toHaveLength(2);
  });
});
