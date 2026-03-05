import { describe, expect, test } from "bun:test";
import { HttpClient, HttpClientRequest, HttpServer } from "@effect/platform";
import { BunHttpServer } from "@effect/platform-bun";
import { Effect, Layer } from "effect";

import { createRouter } from "@/api/router";
import { DashboardDbTest } from "@/services/dashboard-db";
import { StatsServiceLive } from "@/services/stats";

function makeAppLayer() {
  const serveLayer = HttpServer.serve(createRouter());
  return serveLayer.pipe(
    Layer.provide(StatsServiceLive),
    Layer.provide(DashboardDbTest),
    Layer.provideMerge(BunHttpServer.layerTest),
  );
}

describe("createRouter", () => {
  test("GET /api/health returns 200 with JSON status ok", async () => {
    const AppLayer = makeAppLayer();

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

  test("GET /nonexistent returns 404 with styled HTML body", async () => {
    const AppLayer = makeAppLayer();

    const program = Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;
      const response = yield* client.execute(
        HttpClientRequest.get("/nonexistent"),
      );
      const text = yield* response.text;
      return {
        status: response.status,
        text,
        contentType: response.headers["content-type"],
      };
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(AppLayer)),
    );

    expect(result.status).toBe(404);
    expect(result.contentType).toContain("text/html");
    expect(result.text).toContain("404");
  });
});
