import { describe, expect, test } from "bun:test";

import { Effect, Layer } from "effect";

import { DashboardDb, DashboardDbTest } from "@/services/dashboard-db";
import { StatsServiceLive } from "@/services/stats";
import { modelsPageHandler } from "@/ui/routes";

const TestLayer = Layer.mergeAll(
  DashboardDbTest,
  Layer.provide(StatsServiceLive, DashboardDbTest),
);

describe("GET /models", () => {
  test("returns 200 HTML page with models heading and table", async () => {
    const program = Effect.gen(function* () {
      const { sqlite } = yield* DashboardDb;
      sqlite
        .prepare(
          `INSERT INTO messages
            (id, session_id, role, provider_id, model_id, cost, tokens_input, tokens_output, tokens_reasoning, time_created)
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

      const req = new Request("http://localhost:3000/models");
      const response = yield* modelsPageHandler(req);
      const body = yield* Effect.promise(() => response.text());

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toContain("text/html");
      expect(body).toContain("Models");
      expect(body).toContain("← Dashboard");
      expect(body).toContain("Provider");
      expect(body).toContain("anthropic");
      // Regression: main must use class="models-page" so CSS padding applies
      expect(body).toContain('class="models-page"');
    });

    await Effect.runPromise(Effect.provide(program, TestLayer));
  });
});
