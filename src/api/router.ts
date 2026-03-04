import {
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from "@effect/platform";
import { Effect } from "effect";

import { healthHandler } from "@/api/health";
import {
  apiDailyDetailHandler,
  sessionDetailHandler,
  sessionsListHandler,
} from "@/api/sessions";
import {
  statsDailyHandler,
  statsModelsHandler,
  statsOverviewHandler,
  statsProjectsHandler,
} from "@/api/stats";
import type { DashboardDb } from "@/services/dashboard-db";
import type { StatsService } from "@/services/stats";
import {
  dailyDetailPageHandler,
  modelsPageHandler,
  projectsPageHandler,
  rootHandler,
  sessionPageHandler,
  sessionsListPageHandler,
  staticStylesHandler,
} from "@/ui/routes";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function internalError(message: string): Response {
  return new Response(JSON.stringify({ error: { message } }), {
    status: 500,
    headers: { "Content-Type": "application/json" },
  });
}

function resolveWebRequest(
  serverReq: HttpServerRequest.HttpServerRequest,
): Request {
  const either = HttpServerRequest.toWebEither(serverReq);
  return either._tag === "Right"
    ? either.right
    : new Request(serverReq.url, { method: serverReq.method });
}

/**
 * liftHandler - wraps a (Request -> Effect<Response, E, R>) handler
 * into an HttpRouter-compatible handler, catching errors as 500 responses.
 */
function liftHandler<E, R>(
  handler: (req: Request) => Effect.Effect<Response, E, R>,
): Effect.Effect<
  HttpServerResponse.HttpServerResponse,
  never,
  R | HttpServerRequest.HttpServerRequest
> {
  return Effect.gen(function* () {
    const serverReq = yield* HttpServerRequest.HttpServerRequest;
    const webReq = resolveWebRequest(serverReq);
    const response = yield* handler(webReq).pipe(
      Effect.catchAll((e) =>
        Effect.succeed(
          internalError(
            e instanceof Error ? e.message : "Internal server error",
          ),
        ),
      ),
    );
    return HttpServerResponse.raw(response);
  });
}

/**
 * liftAsyncHandler - wraps a (Request -> Promise<Response>) handler.
 */
function liftAsyncHandler(
  handler: (req: Request) => Promise<Response>,
): Effect.Effect<
  HttpServerResponse.HttpServerResponse,
  never,
  HttpServerRequest.HttpServerRequest
> {
  return Effect.gen(function* () {
    const serverReq = yield* HttpServerRequest.HttpServerRequest;
    const webReq = resolveWebRequest(serverReq);
    const response = yield* Effect.promise(() => handler(webReq));
    return HttpServerResponse.raw(response);
  });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

/**
 * createRouter - composes all route fragments into a single HttpRouter.
 * Replaces the hand-rolled Bun.serve/URL switch in main.ts.
 */
export function createRouter(): HttpRouter.HttpRouter<
  never,
  DashboardDb | StatsService
> {
  return HttpRouter.empty.pipe(
    HttpRouter.get("/api/health", liftHandler(healthHandler)),
    HttpRouter.get("/api/stats/overview", liftHandler(statsOverviewHandler)),
    HttpRouter.get("/api/stats/daily", liftHandler(statsDailyHandler)),
    HttpRouter.get("/api/stats/models", liftHandler(statsModelsHandler)),
    HttpRouter.get("/api/stats/projects", liftHandler(statsProjectsHandler)),
    HttpRouter.get("/api/sessions", liftHandler(sessionsListHandler)),
    HttpRouter.get(
      "/api/daily/:date",
      Effect.gen(function* () {
        const serverReq = yield* HttpServerRequest.HttpServerRequest;
        const { date } = yield* HttpRouter.params;
        const webReq = resolveWebRequest(serverReq);
        const response = yield* apiDailyDetailHandler(webReq, date ?? "").pipe(
          Effect.catchAll(() =>
            Effect.succeed(internalError("Internal server error")),
          ),
        );
        return HttpServerResponse.raw(response);
      }),
    ),
    HttpRouter.get(
      "/api/sessions/:id",
      Effect.gen(function* () {
        const serverReq = yield* HttpServerRequest.HttpServerRequest;
        const { id } = yield* HttpRouter.params;
        const webReq = resolveWebRequest(serverReq);
        const response = yield* sessionDetailHandler(webReq, id ?? "").pipe(
          Effect.catchAll(() =>
            Effect.succeed(internalError("Internal server error")),
          ),
        );
        return HttpServerResponse.raw(response);
      }),
    ),
    HttpRouter.get("/static/styles.css", liftAsyncHandler(staticStylesHandler)),
    HttpRouter.get("/models", liftHandler(modelsPageHandler)),
    HttpRouter.get("/projects", liftHandler(projectsPageHandler)),
    HttpRouter.get("/sessions", liftHandler(sessionsListPageHandler)),
    HttpRouter.get(
      "/daily/:date",
      Effect.gen(function* () {
        const serverReq = yield* HttpServerRequest.HttpServerRequest;
        const { date } = yield* HttpRouter.params;
        const webReq = resolveWebRequest(serverReq);
        const response = yield* dailyDetailPageHandler(webReq, date ?? "").pipe(
          Effect.catchAll(() =>
            Effect.succeed(internalError("Internal server error")),
          ),
        );
        return HttpServerResponse.raw(response);
      }),
    ),
    HttpRouter.get(
      "/sessions/:id",
      Effect.gen(function* () {
        const serverReq = yield* HttpServerRequest.HttpServerRequest;
        const { id } = yield* HttpRouter.params;
        const webReq = resolveWebRequest(serverReq);
        const response = yield* sessionPageHandler(webReq, id ?? "").pipe(
          Effect.catchAll(() =>
            Effect.succeed(internalError("Internal server error")),
          ),
        );
        return HttpServerResponse.raw(response);
      }),
    ),
    HttpRouter.get("/", liftHandler(rootHandler)),
  );
}
