import { describe, expect, test } from "bun:test";

import { Effect, Layer } from "effect";

import {
  statsAnomaliesHandler,
  statsCostShareModelsHandler,
  statsCostShareProjectsHandler,
  statsDailyHandler,
  statsKpisHandler,
  statsModelsHandler,
  statsOverviewHandler,
  statsProjectsHandler,
  statsTrendsHandler,
} from "@/api/stats";
import { DashboardDb, DashboardDbTest } from "@/services/dashboard-db";
import { StatsServiceLive } from "@/services/stats";

const TestLayer = Layer.mergeAll(
  DashboardDbTest,
  Layer.provide(StatsServiceLive, DashboardDbTest),
);

describe("GET /api/stats/overview", () => {
  test("returns 200 with full overview totals", async () => {
    const program = Effect.gen(function* () {
      const { sqlite } = yield* DashboardDb;
      sqlite
        .prepare(
          `INSERT INTO sessions
            (id, project_id, title, message_count, total_cost, total_tokens_input,
             total_tokens_output, total_tokens_reasoning, total_cache_read,
             total_cache_write, time_updated)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run("s1", "p1", "Session 1", 5, 0.01, 100, 200, 0, 10, 20, 1000);
      sqlite
        .prepare(
          `INSERT INTO sessions
            (id, project_id, title, message_count, total_cost, total_tokens_input,
             total_tokens_output, total_tokens_reasoning, total_cache_read,
             total_cache_write, time_updated)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run("s2", "p1", "Session 2", 3, 0.02, 50, 100, 0, 5, 10, 2000);

      // Insert messages to match message_count in sessions
      const insertMsg = sqlite.prepare(
        `INSERT INTO messages
          (id, session_id, role, cost, tokens_input, tokens_output, time_created)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      );
      for (let i = 1; i <= 8; i++) {
        insertMsg.run(
          `m${i}`,
          i <= 5 ? "s1" : "s2",
          "assistant",
          0,
          0,
          0,
          i * 100,
        );
      }

      const req = new Request("http://localhost:3000/api/stats/overview");
      return yield* statsOverviewHandler(req);
    });

    const response = await Effect.runPromise(
      program.pipe(Effect.provide(TestLayer)),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: Record<string, unknown> };
    expect(body.data.totalSessions).toBe(2);
    expect(body.data.totalMessages).toBe(8);
    expect(typeof body.data.totalCost).toBe("number");
    expect(body.data.totalTokensInput).toBe(150);
    expect(body.data.totalTokensOutput).toBe(300);
  });

  test("returns zeros when no data", async () => {
    const req = new Request("http://localhost:3000/api/stats/overview");
    const response = await Effect.runPromise(
      statsOverviewHandler(req).pipe(Effect.provide(TestLayer)),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: Record<string, unknown> };
    expect(body.data.totalSessions).toBe(0);
    expect(body.data.totalCost).toBe(0);
  });
});

describe("GET /api/stats/daily", () => {
  test("returns 200 with daily stats for date range", async () => {
    const program = Effect.gen(function* () {
      const { sqlite } = yield* DashboardDb;
      sqlite
        .prepare(
          `INSERT INTO daily_stats
            (date, session_count, message_count, total_cost,
             total_tokens_input, total_tokens_output, total_tokens_reasoning,
             total_cache_read, total_cache_write, time_updated)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run("2026-01-01", 2, 10, 0.05, 200, 400, 0, 20, 40, 1000);

      const req = new Request(
        "http://localhost:3000/api/stats/daily?start=2026-01-01&end=2026-01-31",
      );
      return yield* statsDailyHandler(req);
    });

    const response = await Effect.runPromise(
      program.pipe(Effect.provide(TestLayer)),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: { daily: unknown[] } };
    expect(Array.isArray(body.data.daily)).toBe(true);
    expect(body.data.daily).toHaveLength(1);
  });

  test("returns 200 with default last-30-days range when no params given", async () => {
    const req = new Request("http://localhost:3000/api/stats/daily");
    const response = await Effect.runPromise(
      statsDailyHandler(req).pipe(Effect.provide(TestLayer)),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: { daily: unknown[] } };
    expect(Array.isArray(body.data.daily)).toBe(true);
  });

  test("returns 400 when start param is missing", async () => {
    const req = new Request(
      "http://localhost:3000/api/stats/daily?end=2026-01-31",
    );
    const response = await Effect.runPromise(
      statsDailyHandler(req).pipe(Effect.provide(TestLayer)),
    );
    expect(response.status).toBe(400);
  });

  test("returns 400 when end param is missing", async () => {
    const req = new Request(
      "http://localhost:3000/api/stats/daily?start=2026-01-01",
    );
    const response = await Effect.runPromise(
      statsDailyHandler(req).pipe(Effect.provide(TestLayer)),
    );
    expect(response.status).toBe(400);
  });

  test("returns 400 when dates are not YYYY-MM-DD format", async () => {
    const req = new Request(
      "http://localhost:3000/api/stats/daily?start=01/01/2026&end=31/01/2026",
    );
    const response = await Effect.runPromise(
      statsDailyHandler(req).pipe(Effect.provide(TestLayer)),
    );
    expect(response.status).toBe(400);
  });
});

describe("GET /api/stats/models", () => {
  test("returns 200 with model breakdown", async () => {
    const program = Effect.gen(function* () {
      const { sqlite } = yield* DashboardDb;
      sqlite
        .prepare(
          `INSERT INTO messages
            (id, session_id, role, provider_id, model_id, cost,
             tokens_input, tokens_output, tokens_reasoning, time_created)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          "m1",
          "s1",
          "assistant",
          "anthropic",
          "claude-3-5-sonnet",
          0.01,
          100,
          200,
          0,
          1000,
        );

      const req = new Request("http://localhost:3000/api/stats/models");
      return yield* statsModelsHandler(req);
    });

    const response = await Effect.runPromise(
      program.pipe(Effect.provide(TestLayer)),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: { models: unknown[] } };
    expect(Array.isArray(body.data.models)).toBe(true);
    expect(body.data.models).toHaveLength(1);
  });
});

describe("GET /api/stats/projects", () => {
  test("returns 200 with project breakdown", async () => {
    const program = Effect.gen(function* () {
      const { sqlite } = yield* DashboardDb;
      sqlite
        .prepare(
          `INSERT INTO sessions
            (id, project_id, project_name, title, total_cost,
             total_tokens_input, total_tokens_output, time_updated)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run("s1", "p1", "My Project", "Session 1", 0.05, 100, 200, 1000);

      const req = new Request("http://localhost:3000/api/stats/projects");
      return yield* statsProjectsHandler(req);
    });

    const response = await Effect.runPromise(
      program.pipe(Effect.provide(TestLayer)),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: { projects: unknown[] } };
    expect(Array.isArray(body.data.projects)).toBe(true);
    expect(body.data.projects).toHaveLength(1);
  });
});

describe("dashboard v2 stats endpoints", () => {
  test("return envelope data for valid params and 400 for invalid params", async () => {
    const okResponses = await Promise.all([
      Effect.runPromise(
        statsKpisHandler(
          new Request(
            "http://localhost:3000/api/stats/kpis?range=7d&compare=1",
          ),
        ).pipe(Effect.provide(TestLayer)),
      ),
      Effect.runPromise(
        statsTrendsHandler(
          new Request("http://localhost:3000/api/stats/trends?range=30d"),
        ).pipe(Effect.provide(TestLayer)),
      ),
      Effect.runPromise(
        statsCostShareProjectsHandler(
          new Request(
            "http://localhost:3000/api/stats/cost-share/projects?range=90d",
          ),
        ).pipe(Effect.provide(TestLayer)),
      ),
      Effect.runPromise(
        statsCostShareModelsHandler(
          new Request(
            "http://localhost:3000/api/stats/cost-share/models?range=7d",
          ),
        ).pipe(Effect.provide(TestLayer)),
      ),
      Effect.runPromise(
        statsAnomaliesHandler(
          new Request("http://localhost:3000/api/stats/anomalies?range=30d"),
        ).pipe(Effect.provide(TestLayer)),
      ),
    ]);

    for (const response of okResponses) {
      expect(response.status).toBe(200);
      const body = (await response.json()) as { data: unknown };
      expect(body.data).toBeDefined();
    }

    const badResponses = await Promise.all([
      Effect.runPromise(
        statsKpisHandler(
          new Request(
            "http://localhost:3000/api/stats/kpis?range=oops&compare=1",
          ),
        ).pipe(Effect.provide(TestLayer)),
      ),
      Effect.runPromise(
        statsKpisHandler(
          new Request(
            "http://localhost:3000/api/stats/kpis?range=7d&compare=2",
          ),
        ).pipe(Effect.provide(TestLayer)),
      ),
      Effect.runPromise(
        statsTrendsHandler(
          new Request("http://localhost:3000/api/stats/trends?range=oops"),
        ).pipe(Effect.provide(TestLayer)),
      ),
      Effect.runPromise(
        statsCostShareProjectsHandler(
          new Request(
            "http://localhost:3000/api/stats/cost-share/projects?range=oops",
          ),
        ).pipe(Effect.provide(TestLayer)),
      ),
      Effect.runPromise(
        statsCostShareModelsHandler(
          new Request(
            "http://localhost:3000/api/stats/cost-share/models?range=oops",
          ),
        ).pipe(Effect.provide(TestLayer)),
      ),
      Effect.runPromise(
        statsAnomaliesHandler(
          new Request("http://localhost:3000/api/stats/anomalies?range=oops"),
        ).pipe(Effect.provide(TestLayer)),
      ),
    ]);

    for (const response of badResponses) {
      expect(response.status).toBe(400);
    }
  });
});
