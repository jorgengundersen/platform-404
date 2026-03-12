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

  test("smoke: core UI routes return HTML and unknown route returns 404", async () => {
    const AppLayer = makeAppLayer();

    const program = Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;
      const okRoutes = [
        "/",
        "/sessions",
        "/projects",
        "/models",
        "/daily/2026-03-12",
      ];

      const okResponses: Array<{
        path: string;
        status: number;
        contentType: string | undefined;
        text: string;
      }> = [];

      for (const path of okRoutes) {
        const response = yield* client.execute(HttpClientRequest.get(path));
        const text = yield* response.text;
        okResponses.push({
          path,
          status: response.status,
          contentType: response.headers["content-type"],
          text,
        });
      }

      const missingResponse = yield* client.execute(
        HttpClientRequest.get("/this-route-should-404"),
      );

      return {
        okResponses,
        missing: {
          status: missingResponse.status,
          contentType: missingResponse.headers["content-type"],
          text: yield* missingResponse.text,
        },
      };
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(AppLayer)),
    );

    for (const response of result.okResponses) {
      expect(response.path).toBeString();
      expect(response.status).toBe(200);
      expect(response.contentType).toContain("text/html");
      expect(response.text).toContain("platform-404");
    }

    expect(result.missing.status).toBe(404);
    expect(result.missing.contentType).toContain("text/html");
    expect(result.missing.text).toContain("Page not found");
  });
});
