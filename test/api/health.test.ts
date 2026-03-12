import { describe, expect, test } from "bun:test";

import { Effect } from "effect";

import { healthHandler } from "@/api/health";
import { DashboardDb, DashboardDbTest } from "@/services/dashboard-db";

describe("GET /api/health", () => {
  test("returns 200 with empty sources when no cursors", async () => {
    const req = new Request("http://localhost:3000/api/health", {
      method: "GET",
    });

    const response = await Effect.runPromise(
      healthHandler(req).pipe(Effect.provide(DashboardDbTest)),
    );

    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      data: { status: string; sources: Record<string, unknown> };
    };
    expect(body).toEqual({
      data: {
        status: "ok",
        sources: {},
      },
    });
  });

  test("returns per-source sync status for each ingestion_cursor row", async () => {
    const now = Date.now();

    const program = Effect.gen(function* () {
      const { sqlite } = yield* DashboardDb;
      sqlite
        .prepare(
          "INSERT INTO ingestion_cursor (source, last_time_updated, last_synced_at) VALUES (?, ?, ?)",
        )
        .run("opencode:session", now - 1000, now);
      sqlite
        .prepare(
          "INSERT INTO ingestion_cursor (source, last_time_updated, last_synced_at) VALUES (?, ?, ?)",
        )
        .run("opencode:message", now - 500, now - 100);

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
      data: {
        status: string;
        sources: Record<string, { lastUpdated: number; lastSyncedAt: number }>;
      };
    };
    expect(body.data.status).toBe("ok");
    expect(body.data.sources["opencode:session"]).toEqual({
      lastUpdated: now - 1000,
      lastSyncedAt: now,
    });
    expect(body.data.sources["opencode:message"]).toEqual({
      lastUpdated: now - 500,
      lastSyncedAt: now - 100,
    });
  });
});
