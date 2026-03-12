import { HttpServer } from "@effect/platform";
import { BunHttpServer, BunRuntime } from "@effect/platform-bun";
import { Effect, Layer, Schedule } from "effect";
import { SourceDbLive } from "@/adapters/opencode/source-db";
import { createRouter } from "@/api/router";
import { getConfig } from "@/config";
import { getPort } from "@/primitives/port";
import { DashboardDbLive } from "@/services/dashboard-db";
import { IngestionService, IngestionServiceLive } from "@/services/ingestion";
import { StatsServiceLive } from "@/services/stats";

// ---------------------------------------------------------------------------
// Layer composition helpers
// ---------------------------------------------------------------------------

function buildLayers(config: ReturnType<typeof getConfig>, port: number) {
  const dashboardDbLayer = DashboardDbLive(config.dashboardDbPath);
  const sourceDbLayer = SourceDbLive(config.opencodeDbPath);
  const statsLayer = StatsServiceLive.pipe(Layer.provide(dashboardDbLayer));
  const ingestionLayer = IngestionServiceLive.pipe(
    Layer.provide(sourceDbLayer),
    Layer.provide(dashboardDbLayer),
  );

  // Wire the HTTP router layer: serve(router) needs HttpServer | DashboardDb | StatsService
  const router = createRouter();
  const serverLayer = HttpServer.serve(router).pipe(
    Layer.provide(statsLayer),
    Layer.provide(dashboardDbLayer),
    Layer.provide(BunHttpServer.layer({ port })),
  );

  return { ingestionLayer, serverLayer };
}

// ---------------------------------------------------------------------------
// Ingestion loop
// ---------------------------------------------------------------------------

function buildIngestionLoop(
  syncIntervalMs: number,
): Effect.Effect<never, never, IngestionService> {
  const runOnce = Effect.gen(function* () {
    const svc = yield* IngestionService;
    yield* svc.ingestOnce.pipe(
      Effect.catchAll((e) =>
        Effect.sync(() => {
          console.error("[ingestion] error:", e.reason);
        }),
      ),
    );
  });

  // Run immediately, then on fixed interval
  return runOnce.pipe(
    Effect.andThen(Effect.repeat(runOnce, Schedule.fixed(syncIntervalMs))),
    Effect.map(() => undefined as never),
  );
}

// ---------------------------------------------------------------------------
// boot - async entry point (used in tests / manual invocation)
// ---------------------------------------------------------------------------

/**
 * boot - Starts the HTTP server with all service layers and periodic ingestion.
 *
 * Composition root. Pure function with no side effects on import.
 */
export async function boot(): Promise<void> {
  // Fail fast on missing/invalid required config.
  const config = getConfig();
  const port = getPort();
  const { ingestionLayer, serverLayer } = buildLayers(config, port);

  const main = Effect.gen(function* () {
    // Start periodic ingestion as a background daemon fiber.
    yield* Effect.forkDaemon(
      buildIngestionLoop(config.syncIntervalMs).pipe(
        Effect.provide(ingestionLayer),
      ),
    );

    yield* Effect.log(`Server running on http://localhost:${port}`);

    // Keep the process alive (BunHttpServer scope keeps the server running).
    yield* Effect.never;
  });

  await Effect.runPromise(main.pipe(Effect.provide(serverLayer)));
}

// ---------------------------------------------------------------------------
// runMain - BunRuntime entry point with graceful shutdown
// ---------------------------------------------------------------------------

/**
 * runMain - called from index.ts with BunRuntime signal handling.
 */
export function runMain(): void {
  const config = getConfig();
  const port = getPort();
  const { ingestionLayer, serverLayer } = buildLayers(config, port);

  const main = Effect.gen(function* () {
    yield* Effect.forkDaemon(
      buildIngestionLoop(config.syncIntervalMs).pipe(
        Effect.provide(ingestionLayer),
      ),
    );

    yield* Effect.log(`Server running on http://localhost:${port}`);
    yield* Effect.never;
  });

  BunRuntime.runMain(main.pipe(Effect.provide(serverLayer)));
}
