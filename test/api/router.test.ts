import { describe, expect, test } from "bun:test";
import { HttpClient, HttpClientRequest, HttpServer } from "@effect/platform";
import { BunHttpServer } from "@effect/platform-bun";
import { Effect, Layer } from "effect";

import { createRouter } from "@/api/router";
import { type DashboardDb, DashboardDbTest } from "@/services/dashboard-db";
import { type StatsService, StatsServiceLive } from "@/services/stats";

describe("createRouter", () => {
  test("GET /api/health returns 200 with JSON status ok", async () => {
    const router = createRouter();

    // Layer composition:
    // serve(router) needs: HttpServer | DashboardDb | StatsService
    // Explicitly cast to avoid TypeScript overload confusion with dual-mode serve
    const serveLayer = HttpServer.serve(
      router as Effect.Effect<
        import("@effect/platform").HttpServerResponse.HttpServerResponse,
        import("@effect/platform").HttpServerError.RouteNotFound,
        DashboardDb | StatsService
      >,
    );

    const AppLayer = serveLayer.pipe(
      Layer.provide(StatsServiceLive),
      Layer.provide(DashboardDbTest),
      Layer.provideMerge(BunHttpServer.layerTest),
    );

    const program = Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;
      const response = yield* client.execute(
        HttpClientRequest.get("/api/health"),
      );
      const body = yield* response.json;
      return { status: response.status, body };
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(AppLayer)),
    );

    expect(result.status).toBe(200);
    expect((result.body as { data: { status: string } }).data.status).toBe(
      "ok",
    );
  });
});
