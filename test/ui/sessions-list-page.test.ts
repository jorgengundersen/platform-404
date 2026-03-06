import { describe, expect, test } from "bun:test";

import { Effect, Layer } from "effect";

import { DashboardDb, DashboardDbTest } from "@/services/dashboard-db";
import { StatsServiceLive } from "@/services/stats";
import { sessionsListPageHandler } from "@/ui/routes";

const TestLayer = Layer.mergeAll(
  DashboardDbTest,
  Layer.provide(StatsServiceLive, DashboardDbTest),
);

describe("GET /sessions", () => {
  test("returns 200 HTML page with sessions heading, table, and back link", async () => {
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

      const req = new Request("http://localhost:3000/sessions");
      const response = yield* sessionsListPageHandler(req);
      const body = yield* Effect.promise(() => response.text());

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toContain("text/html");
      expect(body).toContain("Sessions");
      expect(body).toContain("← Dashboard");
      expect(body).toContain("Project");
      expect(body).toContain("my-project");
      expect(body).toContain("Test Session");
    });

    await Effect.runPromise(Effect.provide(program, TestLayer));
  });

  test("back-link reads '← Projects' and points to /projects when project filter is active", async () => {
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
          "s2",
          "proj-abc",
          "filtered-project",
          "Filtered Session",
          1,
          0.01,
          100,
          200,
          0,
          0,
          0,
          1000,
          2000,
        );

      const req = new Request(
        "http://localhost:3000/sessions?project=proj-abc",
      );
      const response = yield* sessionsListPageHandler(req);
      const body = yield* Effect.promise(() => response.text());

      expect(body).toContain('href="/projects"');
      expect(body).toContain("← Projects");
      expect(body).not.toContain('class="back-link">← Dashboard');
    });

    await Effect.runPromise(Effect.provide(program, TestLayer));
  });

  test("Date Range stat card uses smaller font modifier class", async () => {
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

      const req = new Request("http://localhost:3000/sessions");
      const response = yield* sessionsListPageHandler(req);
      const body = yield* Effect.promise(() => response.text());

      // Date Range value should use the smaller modifier class to prevent overflow
      expect(body).toContain('class="stat-card__value stat-card__value--sm"');
    });

    await Effect.runPromise(Effect.provide(program, TestLayer));
  });

  test("shows truncated projectId when project_name is NULL", async () => {
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
          "s-null-proj",
          "07c33b5c4dd6cd7d65dc7410e1692478dec5e335",
          null,
          "No Name Session",
          1,
          0.01,
          100,
          200,
          0,
          0,
          0,
          1000,
          2000,
        );

      const req = new Request("http://localhost:3000/sessions");
      const response = yield* sessionsListPageHandler(req);
      const body = yield* Effect.promise(() => response.text());

      // Should show the first 8 chars of project_id, not empty string
      expect(body).toContain("07c33b5c");
      expect(body).not.toContain(">  <"); // no empty td
    });

    await Effect.runPromise(Effect.provide(program, TestLayer));
  });

  test("clamps out-of-bounds page to last valid page", async () => {
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

      // With 1 session and limit=50, lastPage=1. Page 999 should be clamped to 1.
      const req = new Request("http://localhost:3000/sessions?page=999");
      const response = yield* sessionsListPageHandler(req);
      const body = yield* Effect.promise(() => response.text());

      expect(response.status).toBe(200);
      // Should show "1 / 1" not "999 / 1"
      expect(body).toContain("1 / 1");
      expect(body).not.toContain("999");
      // Should show the session (not an empty table)
      expect(body).toContain("Test Session");
      // Prev link to page 998 must not appear
      expect(body).not.toContain("page=998");
    });

    await Effect.runPromise(Effect.provide(program, TestLayer));
  });
});
