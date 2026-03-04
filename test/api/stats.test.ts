import { describe, expect, test } from "bun:test";

import { Effect } from "effect";

import { statsOverviewHandler } from "@/api/stats";
import { DashboardDb, DashboardDbTest } from "@/services/dashboard-db";

describe("GET /api/stats/overview", () => {
  test("returns 200 with totalSessions count", async () => {
    const program = Effect.gen(function* () {
      const { sqlite } = yield* DashboardDb;
      const insert = sqlite.prepare(
        "INSERT INTO sessions (id, project_id, title, time_updated) VALUES (?, ?, ?, ?)",
      );
      insert.run("s1", "p1", "Session 1", 1000);
      insert.run("s2", "p1", "Session 2", 2000);
      insert.run("s3", "p2", "Session 3", 3000);

      const req = new Request("http://localhost:3000/api/stats/overview");
      return yield* statsOverviewHandler(req);
    });

    const response = await Effect.runPromise(
      program.pipe(Effect.provide(DashboardDbTest)),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ data: { totalSessions: 3 } });
  });

  test("returns totalSessions: 0 when no sessions", async () => {
    const req = new Request("http://localhost:3000/api/stats/overview");
    const response = await Effect.runPromise(
      statsOverviewHandler(req).pipe(Effect.provide(DashboardDbTest)),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ data: { totalSessions: 0 } });
  });
});
