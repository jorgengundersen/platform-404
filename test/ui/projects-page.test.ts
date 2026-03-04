import { describe, expect, test } from "bun:test";

import { Effect, Layer } from "effect";

import { DashboardDb, DashboardDbTest } from "@/services/dashboard-db";
import { StatsServiceLive } from "@/services/stats";
import { projectsPageHandler } from "@/ui/routes";

const TestLayer = Layer.mergeAll(
  DashboardDbTest,
  Layer.provide(StatsServiceLive, DashboardDbTest),
);

describe("GET /projects", () => {
  test("returns 200 HTML page with projects heading and table", async () => {
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

      const req = new Request("http://localhost:3000/projects");
      const response = yield* projectsPageHandler(req);
      const body = yield* Effect.promise(() => response.text());

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toContain("text/html");
      expect(body).toContain("Projects");
      expect(body).toContain("← Dashboard");
      expect(body).toContain("Project Name");
      expect(body).toContain("my-project");
    });

    await Effect.runPromise(Effect.provide(program, TestLayer));
  });
});
