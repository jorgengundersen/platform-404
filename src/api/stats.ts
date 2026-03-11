import { Schema } from "@effect/schema";
import { Effect } from "effect";

import {
  DashboardCompareQueryParam,
  DashboardRangeQueryParam,
  DateRangeParams,
} from "@/primitives/schemas/api-params";
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

function parseRange(
  rawRange: string | null,
): { range: "7d" | "30d" | "90d" } | null {
  const rangeResult = Schema.decodeUnknownEither(DashboardRangeQueryParam)(
    rawRange,
  );
  if (rangeResult._tag === "Left") {
    return null;
  }
  return { range: rangeResult.right };
}

function parseCompare(rawCompare: string | null): { compare: boolean } | null {
  const compareResult = Schema.decodeUnknownEither(DashboardCompareQueryParam)(
    rawCompare,
  );
  if (compareResult._tag === "Left") {
    return null;
  }
  return { compare: compareResult.right === "1" };
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

export const statsKpisHandler = (
  req: Request,
): Effect.Effect<Response, StatsError, StatsService> =>
  Effect.gen(function* () {
    const url = new URL(req.url);
    const parsedRange = parseRange(url.searchParams.get("range"));
    const parsedCompare = parseCompare(url.searchParams.get("compare"));
    if (parsedRange === null || parsedCompare === null) {
      return jsonError("Invalid range or compare query param");
    }

    const stats = yield* StatsService;
    const kpis = yield* stats.getKpiSummary({
      range: parsedRange.range,
      compare: parsedCompare.compare,
    });
    return jsonOk({ kpis });
  });

export const statsTrendsHandler = (
  req: Request,
): Effect.Effect<Response, StatsError, StatsService> =>
  Effect.gen(function* () {
    const url = new URL(req.url);
    const parsedRange = parseRange(url.searchParams.get("range"));
    if (parsedRange === null) {
      return jsonError("Invalid range query param");
    }

    const stats = yield* StatsService;
    const trends = yield* stats.getTrendSeries({ range: parsedRange.range });
    return jsonOk({ trends });
  });

export const statsCostShareProjectsHandler = (
  req: Request,
): Effect.Effect<Response, StatsError, StatsService> =>
  Effect.gen(function* () {
    const url = new URL(req.url);
    const parsedRange = parseRange(url.searchParams.get("range"));
    if (parsedRange === null) {
      return jsonError("Invalid range query param");
    }

    const stats = yield* StatsService;
    const projects = yield* stats.getProjectCostShare({
      range: parsedRange.range,
    });
    return jsonOk({ projects });
  });

export const statsCostShareModelsHandler = (
  req: Request,
): Effect.Effect<Response, StatsError, StatsService> =>
  Effect.gen(function* () {
    const url = new URL(req.url);
    const parsedRange = parseRange(url.searchParams.get("range"));
    if (parsedRange === null) {
      return jsonError("Invalid range query param");
    }

    const stats = yield* StatsService;
    const models = yield* stats.getModelCostShare({ range: parsedRange.range });
    return jsonOk({ models });
  });

export const statsAnomaliesHandler = (
  req: Request,
): Effect.Effect<Response, StatsError, StatsService> =>
  Effect.gen(function* () {
    const url = new URL(req.url);
    const parsedRange = parseRange(url.searchParams.get("range"));
    if (parsedRange === null) {
      return jsonError("Invalid range query param");
    }

    const stats = yield* StatsService;
    const anomalies = yield* stats.getAnomalies({ range: parsedRange.range });
    return jsonOk({ anomalies });
  });
