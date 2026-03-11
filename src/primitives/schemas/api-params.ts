import { Schema } from "@effect/schema";
import { Option } from "effect";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * DateRangeParams - validated query params for date range endpoints.
 * Both start and end must be in YYYY-MM-DD format.
 */
export const DateRangeParams = Schema.Struct({
  start: Schema.String.pipe(Schema.pattern(DATE_RE)),
  end: Schema.String.pipe(Schema.pattern(DATE_RE)),
});

export type DateRangeParams = typeof DateRangeParams.Type;

/**
 * SessionsListParams - validated query params for paginated sessions list.
 * page: positive integer, default 1
 * limit: integer 1-100, default 20
 */
export const SessionsListParams = Schema.Struct({
  page: Schema.optionalWith(
    Schema.Number.pipe(
      Schema.int(),
      Schema.between(1, Number.MAX_SAFE_INTEGER),
    ),
    { default: () => 1 },
  ),
  limit: Schema.optionalWith(
    Schema.Number.pipe(Schema.int(), Schema.between(1, 100)),
    { default: () => 20 },
  ),
});

export type SessionsListParams = typeof SessionsListParams.Type;

/**
 * SessionsListQueryParams - decodes string query params from URL into SessionsListParams.
 * Accepts string or undefined values (as returned by URLSearchParams.get()).
 */
export const SessionsListQueryParams = Schema.Struct({
  page: Schema.optionalWith(
    Schema.NumberFromString.pipe(
      Schema.int(),
      Schema.between(1, Number.MAX_SAFE_INTEGER),
    ),
    { default: () => 1 },
  ),
  limit: Schema.optionalWith(
    Schema.NumberFromString.pipe(Schema.int(), Schema.between(1, 100)),
    { default: () => 20 },
  ),
});

export type SessionsListQueryParams = typeof SessionsListQueryParams.Type;

export const DashboardRangeQueryParam = Schema.Literal("7d", "30d", "90d");
export type DashboardRangeQueryParam = typeof DashboardRangeQueryParam.Type;

export const DashboardCompareQueryParam = Schema.Literal("0", "1");
export type DashboardCompareQueryParam = typeof DashboardCompareQueryParam.Type;

export interface DashboardRootQueryParams {
  range: DashboardRangeQueryParam;
  compare: DashboardCompareQueryParam;
}

const decodeDashboardRangeQueryParam = Schema.decodeUnknownOption(
  DashboardRangeQueryParam,
);
const decodeDashboardCompareQueryParam = Schema.decodeUnknownOption(
  DashboardCompareQueryParam,
);

export function decodeDashboardRootQueryParams(raw: {
  range?: string;
  compare?: string;
}): DashboardRootQueryParams {
  const range: DashboardRangeQueryParam = Option.getOrElse(
    decodeDashboardRangeQueryParam(raw.range),
    () => "30d" as const,
  );
  const compare: DashboardCompareQueryParam = Option.getOrElse(
    decodeDashboardCompareQueryParam(raw.compare),
    () => "1" as const,
  );

  return { range, compare };
}
