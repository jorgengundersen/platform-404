import { Schema } from "@effect/schema";
import { Effect } from "effect";

import { DateRangeParams } from "@/primitives/schemas/api-params";
import { formatDate } from "@/primitives/time";
import { type StatsError, StatsService } from "@/services/stats";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
 * Query params: start (YYYY-MM-DD), end (YYYY-MM-DD) - both optional, default to last 30 days.
 */
export const statsDailyHandler = (
  req: Request,
): Effect.Effect<Response, StatsError, StatsService> =>
  Effect.gen(function* () {
    const url = new URL(req.url);
    const rawStart = url.searchParams.get("start") ?? undefined;
    const rawEnd = url.searchParams.get("end") ?? undefined;

    let start: string;
    let end: string;

    if (rawStart === undefined && rawEnd === undefined) {
      const now = Date.now();
      end = formatDate(now);
      start = formatDate(now - 30 * 24 * 60 * 60 * 1000);
    } else {
      const raw = { start: rawStart, end: rawEnd };
      const parseResult = Schema.decodeUnknownEither(DateRangeParams)(raw);
      if (parseResult._tag === "Left") {
        return jsonError(
          "Params start and end must be present and in YYYY-MM-DD format",
        );
      }
      ({ start, end } = parseResult.right);
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
