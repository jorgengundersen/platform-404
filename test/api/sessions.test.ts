import { describe, expect, test } from "bun:test";

import { Effect } from "effect";

import { sessionDetailHandler, sessionsListHandler } from "@/api/sessions";
import { DashboardDb, DashboardDbTest } from "@/services/dashboard-db";

const TestLayer = DashboardDbTest;

function seedSession(
  sqlite: import("bun:sqlite").Database,
  id: string,
  projectId = "p1",
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
      projectId,
      "My Project",
      `Session ${id}`,
      3,
      0.01,
      100,
      200,
      0,
      5,
      10,
      1000,
      2000,
    );
}

function seedMessage(
  sqlite: import("bun:sqlite").Database,
  id: string,
  sessionId: string,
): void {
  sqlite
    .prepare(
      `INSERT INTO messages
        (id, session_id, role, provider_id, model_id, cost,
         tokens_input, tokens_output, tokens_reasoning, time_created)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      sessionId,
      "assistant",
      "anthropic",
      "claude-3-5-sonnet",
      0.01,
      100,
      200,
      0,
      1000,
    );
}

describe("GET /api/sessions", () => {
  test("returns 200 with paginated sessions list", async () => {
    const program = Effect.gen(function* () {
      const { sqlite } = yield* DashboardDb;
      seedSession(sqlite, "s1");
      seedSession(sqlite, "s2");

      const req = new Request("http://localhost:3000/api/sessions");
      return yield* sessionsListHandler(req);
    });

    const response = await Effect.runPromise(
      program.pipe(Effect.provide(TestLayer)),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: { sessions: unknown[]; total: number; page: number };
    };
    expect(Array.isArray(body.data.sessions)).toBe(true);
    expect(body.data.sessions).toHaveLength(2);
    expect(body.data.total).toBe(2);
    expect(body.data.page).toBe(1);
  });

  test("respects page and limit params", async () => {
    const program = Effect.gen(function* () {
      const { sqlite } = yield* DashboardDb;
      for (let i = 1; i <= 5; i++) seedSession(sqlite, `s${i}`);

      const req = new Request(
        "http://localhost:3000/api/sessions?page=2&limit=2",
      );
      return yield* sessionsListHandler(req);
    });

    const response = await Effect.runPromise(
      program.pipe(Effect.provide(TestLayer)),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: { sessions: unknown[]; total: number; page: number };
    };
    expect(body.data.sessions).toHaveLength(2);
    expect(body.data.total).toBe(5);
    expect(body.data.page).toBe(2);
  });

  test("returns 400 for invalid page param", async () => {
    const req = new Request("http://localhost:3000/api/sessions?page=abc");
    const response = await Effect.runPromise(
      sessionsListHandler(req).pipe(Effect.provide(TestLayer)),
    );
    expect(response.status).toBe(400);
  });
});

describe("GET /api/sessions/:id", () => {
  test("returns 200 with session detail and messages", async () => {
    const program = Effect.gen(function* () {
      const { sqlite } = yield* DashboardDb;
      seedSession(sqlite, "ses1");
      seedMessage(sqlite, "m1", "ses1");
      seedMessage(sqlite, "m2", "ses1");

      const req = new Request("http://localhost:3000/api/sessions/ses1");
      return yield* sessionDetailHandler(req, "ses1");
    });

    const response = await Effect.runPromise(
      program.pipe(Effect.provide(TestLayer)),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: { session: Record<string, unknown>; messages: unknown[] };
    };
    expect(body.data.session.id).toBe("ses1");
    expect(Array.isArray(body.data.messages)).toBe(true);
    expect(body.data.messages).toHaveLength(2);
  });

  test("returns 404 when session not found", async () => {
    const req = new Request("http://localhost:3000/api/sessions/nonexistent");
    const response = await Effect.runPromise(
      sessionDetailHandler(req, "nonexistent").pipe(Effect.provide(TestLayer)),
    );
    expect(response.status).toBe(404);
  });
});
