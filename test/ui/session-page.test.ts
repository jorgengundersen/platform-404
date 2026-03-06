import { describe, expect, test } from "bun:test";

import { Effect } from "effect";

import { DashboardDb, DashboardDbTest } from "@/services/dashboard-db";
import { sessionPageHandler } from "@/ui/routes";

const TestLayer = DashboardDbTest;

describe("GET /sessions/:id (UI)", () => {
  test("returns 200 HTML with session-detail when session exists", async () => {
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
          "ses_abc",
          "proj_1",
          "my-project",
          "Hello World",
          2,
          0.01,
          50,
          100,
          0,
          0,
          0,
          1000,
          2000,
        );

      const req = new Request("http://localhost:3000/sessions/ses_abc");
      const response = yield* sessionPageHandler(req, "ses_abc");
      const body = yield* Effect.promise(() => response.text());

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toContain("text/html");
      expect(body).toContain("session-detail");
      expect(body).toContain("Hello World");
    });

    await Effect.runPromise(Effect.provide(program, TestLayer));
  });

  test("back-link reads '← Sessions' and points to /sessions", async () => {
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
          "ses_back",
          "proj_1",
          "my-project",
          "Back Link Test",
          1,
          0.0,
          0,
          0,
          0,
          0,
          0,
          1000,
          2000,
        );

      const req = new Request("http://localhost:3000/sessions/ses_back");
      const response = yield* sessionPageHandler(req, "ses_back");
      const body = yield* Effect.promise(() => response.text());

      expect(body).toContain('href="/sessions"');
      expect(body).toContain("← Sessions");
      expect(body).not.toContain('class="back-link">← Dashboard');
    });

    await Effect.runPromise(Effect.provide(program, TestLayer));
  });

  test("returns 404 HTML when session not found", async () => {
    const program = Effect.gen(function* () {
      const req = new Request("http://localhost:3000/sessions/no-such-id");
      const response = yield* sessionPageHandler(req, "no-such-id");

      expect(response.status).toBe(404);
    });

    await Effect.runPromise(Effect.provide(program, TestLayer));
  });
});
