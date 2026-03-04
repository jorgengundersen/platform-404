import { Effect } from "effect";

import { type StatsError, StatsService } from "@/services/stats";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function jsonOk(data: unknown): Response {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function jsonError(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * statsOverviewHandler - Returns full overview totals from StatsService.
 */
export const statsOverviewHandler = (
  _req: Request,
): Effect.Effect<Response, StatsError, StatsService> =>
  Effect.gen(function* () {
    const stats = yield* StatsService;
    const overview = yield* stats.getOverview();
    return jsonOk(overview);
  });

/**
 * statsDailyHandler - Returns daily stats for a date range.
 * Query params: start (YYYY-MM-DD), end (YYYY-MM-DD) - both required.
 */
export const statsDailyHandler = (
  req: Request,
): Effect.Effect<Response, StatsError, StatsService> =>
  Effect.gen(function* () {
    const url = new URL(req.url);
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");

    if (!start || !end) {
      return jsonError("Missing required query params: start, end");
    }

    if (!DATE_RE.test(start) || !DATE_RE.test(end)) {
      return jsonError("Params start and end must be in YYYY-MM-DD format");
    }

    const stats = yield* StatsService;
    const daily = yield* stats.getDailyStats({ start, end });
    return jsonOk({ daily });
  });

/**
 * statsModelsHandler - Returns per-model breakdown.
 */
export const statsModelsHandler = (
  _req: Request,
): Effect.Effect<Response, StatsError, StatsService> =>
  Effect.gen(function* () {
    const stats = yield* StatsService;
    const models = yield* stats.getModelBreakdown();
    return jsonOk({ models });
  });

/**
 * statsProjectsHandler - Returns per-project breakdown.
 */
export const statsProjectsHandler = (
  _req: Request,
): Effect.Effect<Response, StatsError, StatsService> =>
  Effect.gen(function* () {
    const stats = yield* StatsService;
    const projects = yield* stats.getProjectBreakdown();
    return jsonOk({ projects });
  });
