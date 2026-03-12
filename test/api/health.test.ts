import { describe, expect, test } from "bun:test";

import { Effect } from "effect";

import { healthHandler } from "@/api/health";
import { DashboardDb, DashboardDbTest } from "@/services/dashboard-db";

describe("GET /api/health", () => {
  test("returns 200 with JSON { data: { status: 'ok', lastSync: null } } when no cursor", async () => {
    const req = new Request("http://localhost:3000/api/health", {
      method: "GET",
    });

    const response = await Effect.runPromise(
      healthHandler(req).pipe(Effect.provide(DashboardDbTest)),
    );

    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      data: { status: string; lastSync: number | null };
    };
    expect(body).toEqual({
      data: {
        status: "ok",
        lastSync: null,
      },
    });
  });

  test("includes lastSync: number from ingestion_cursor", async () => {
    const now = Date.now();

    const program = Effect.gen(function* () {
      const { sqlite } = yield* DashboardDb;
      sqlite
        .prepare(
          "INSERT INTO ingestion_cursor (source, last_time_updated, last_synced_at) VALUES (?, ?, ?)",
        )
        .run("opencode:session", now, now);

      const req = new Request("http://localhost:3000/api/health", {
        method: "GET",
      });
      return yield* healthHandler(req);
    });

    const response = await Effect.runPromise(
      program.pipe(Effect.provide(DashboardDbTest)),
    );

    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      data: { status: string; lastSync: number | null };
    };
    expect(body.data.lastSync).toBe(now);
  });
});
