import { Context, Data, Effect, Layer } from "effect";
import { formatProjectName } from "@/primitives/project";
import type { DashboardRangeQueryParam } from "@/primitives/schemas/api-params";
import type { SessionSummary } from "@/primitives/schemas/session-summary";
import { dateRangeDays, formatDate } from "@/primitives/time";
import { DashboardDb } from "@/services/dashboard-db";

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class StatsError extends Data.TaggedError("StatsError")<{
  readonly reason: string;
  readonly cause?: unknown;
}> {}

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export interface Overview {
  readonly totalSessions: number;
  readonly totalMessages: number;
  readonly totalCost: number;
  readonly totalTokensInput: number;
  readonly totalTokensOutput: number;
  readonly totalTokensReasoning: number;
  readonly totalCacheRead: number;
  readonly totalCacheWrite: number;
  readonly avgCostPerSession: number;
  readonly avgMessagesPerSession: number;
}

export interface DateRange {
  readonly start: string; // YYYY-MM-DD
  readonly end: string; // YYYY-MM-DD
}

export interface DailyStat {
  readonly date: string;
  readonly source: string;
  readonly sessionCount: number;
  readonly messageCount: number;
  readonly totalCost: number;
  readonly totalTokensInput: number;
  readonly totalTokensOutput: number;
  readonly totalTokensReasoning: number;
  readonly totalCacheRead: number;
  readonly totalCacheWrite: number;
}

export interface ModelStat {
  readonly providerId: string;
  readonly modelId: string;
  readonly messageCount: number;
  readonly totalCost: number;
  readonly totalTokensInput: number;
  readonly totalTokensOutput: number;
}

export interface ProjectStat {
  readonly projectId: string;
  readonly projectName: string | null;
  readonly sessionCount: number;
  readonly totalCost: number;
  readonly totalTokensInput: number;
  readonly totalTokensOutput: number;
}

export interface KpiValue {
  readonly value: number;
  readonly deltaPct: number | null;
}

export interface KpiSummary {
  readonly spend: KpiValue;
  readonly sessions: KpiValue;
  readonly avgCostPerSession: KpiValue;
  readonly outputInputRatio: KpiValue;
}

export interface TrendPoint {
  readonly date: string;
  readonly cost: number;
  readonly sessions: number;
  readonly tokensInput: number;
  readonly tokensOutput: number;
  readonly tokensReasoning: number;
}

export interface CostShareItem {
  readonly label: string;
  readonly key: string;
  readonly cost: number;
  readonly sharePct: number;
}

export interface AnomalyItem {
  readonly type: "cost_spike" | "model_spike";
  readonly date: string;
  readonly severity: "low" | "medium" | "high";
  readonly message: string;
  readonly href: string;
}

export interface ExpensiveSessionItem {
  readonly sessionId: string;
  readonly title: string;
  readonly totalCost: number;
  readonly date: string;
  readonly href: string;
}

// ---------------------------------------------------------------------------
// Service interface
// ---------------------------------------------------------------------------

export class StatsService extends Context.Tag("StatsService")<
  StatsService,
  {
    readonly getOverview: (
      source?: string,
    ) => Effect.Effect<Overview, StatsError>;
    readonly getDailyStats: (
      range: DateRange,
      source?: string,
    ) => Effect.Effect<DailyStat[], StatsError>;
    readonly getKpiSummary: (params: {
      range: DashboardRangeQueryParam;
      compare: boolean;
      source?: string;
    }) => Effect.Effect<KpiSummary, StatsError>;
    readonly getTrendSeries: (params: {
      range: DashboardRangeQueryParam;
      source?: string;
    }) => Effect.Effect<TrendPoint[], StatsError>;
    readonly getProjectCostShare: (params: {
      range: DashboardRangeQueryParam;
    }) => Effect.Effect<CostShareItem[], StatsError>;
    readonly getModelCostShare: (params: {
      range: DashboardRangeQueryParam;
    }) => Effect.Effect<CostShareItem[], StatsError>;
    readonly getAnomalies: (params: {
      range: DashboardRangeQueryParam;
      source?: string;
    }) => Effect.Effect<AnomalyItem[], StatsError>;
    readonly getExpensiveSessions: (params: {
      range: DashboardRangeQueryParam;
      source?: string;
    }) => Effect.Effect<ExpensiveSessionItem[], StatsError>;
    readonly getModelBreakdown: () => Effect.Effect<ModelStat[], StatsError>;
    readonly getProjectBreakdown: () => Effect.Effect<
      ProjectStat[],
      StatsError
    >;
    readonly getSessionsForDate: (
      date: string,
    ) => Effect.Effect<SessionSummary[], StatsError>;
    readonly getSessions: (params: {
      projectId?: string;
      source?: string;
    }) => Effect.Effect<SessionSummary[], StatsError>;
  }
>() {}

// ---------------------------------------------------------------------------
// Raw row types
// ---------------------------------------------------------------------------

interface OverviewRow {
  total_sessions: number;
  total_messages: number;
  total_cost: number | null;
  total_tokens_input: number | null;
  total_tokens_output: number | null;
  total_tokens_reasoning: number | null;
  total_cache_read: number | null;
  total_cache_write: number | null;
}

interface DailyStatRow {
  date: string;
  source: string | null;
  session_count: number;
  message_count: number;
  total_cost: number | null;
  total_tokens_input: number | null;
  total_tokens_output: number | null;
  total_tokens_reasoning: number | null;
  total_cache_read: number | null;
  total_cache_write: number | null;
}

interface ModelStatRow {
  provider_id: string;
  model_id: string;
  message_count: number;
  total_cost: number | null;
  total_tokens_input: number | null;
  total_tokens_output: number | null;
}

interface ProjectStatRow {
  project_id: string;
  project_name: string | null;
  session_count: number;
  total_cost: number | null;
  total_tokens_input: number | null;
  total_tokens_output: number | null;
}

interface SessionRow {
  id: string;
  source: string | null;
  project_id: string;
  project_name: string | null;
  title: string | null;
  message_count: number | null;
  total_cost: number | null;
  total_tokens_input: number | null;
  total_tokens_output: number | null;
  total_tokens_reasoning: number | null;
  total_cache_read: number | null;
  total_cache_write: number | null;
  time_created: number | null;
  time_updated: number | null;
}

interface KpiAggregateRow {
  session_count: number;
  total_cost: number | null;
  total_tokens_input: number | null;
  total_tokens_output: number | null;
}

interface DailyCostRow {
  date: string;
  total_cost: number | null;
}

interface ModelDailyCostRow {
  date: string;
  provider_id: string | null;
  model_id: string;
  total_cost: number | null;
}

interface ExpensiveSessionRow {
  id: string;
  title: string | null;
  total_cost: number | null;
  date: string;
}

interface ProjectCostShareRow {
  project_id: string;
  project_name: string | null;
  total_cost: number | null;
}

interface ModelCostShareRow {
  provider_id: string | null;
  model_id: string;
  total_cost: number | null;
}

// ---------------------------------------------------------------------------
// Layer
// ---------------------------------------------------------------------------

export const StatsServiceLive: Layer.Layer<StatsService, never, DashboardDb> =
  Layer.effect(
    StatsService,
    Effect.gen(function* () {
      const { sqlite } = yield* DashboardDb;

      const getOverview = (
        source?: string,
      ): Effect.Effect<Overview, StatsError> =>
        Effect.try({
          try: () => {
            const row = source
              ? (sqlite
                  .query<
                    OverviewRow,
                    [
                      string,
                      string,
                      string,
                      string,
                      string,
                      string,
                      string,
                      string,
                    ]
                  >(
                    `SELECT
                      (SELECT COUNT(*) FROM sessions WHERE source = ?) AS total_sessions,
                      (SELECT COUNT(*) FROM messages WHERE source = ?) AS total_messages,
                      (SELECT SUM(total_cost) FROM sessions WHERE source = ?) AS total_cost,
                      (SELECT SUM(total_tokens_input) FROM sessions WHERE source = ?) AS total_tokens_input,
                      (SELECT SUM(total_tokens_output) FROM sessions WHERE source = ?) AS total_tokens_output,
                      (SELECT SUM(total_tokens_reasoning) FROM sessions WHERE source = ?) AS total_tokens_reasoning,
                      (SELECT SUM(total_cache_read) FROM sessions WHERE source = ?) AS total_cache_read,
                      (SELECT SUM(total_cache_write) FROM sessions WHERE source = ?) AS total_cache_write`,
                  )
                  .get(
                    source,
                    source,
                    source,
                    source,
                    source,
                    source,
                    source,
                    source,
                  ) as OverviewRow)
              : (sqlite
                  .query<OverviewRow, []>(
                    `SELECT
                      (SELECT COUNT(*) FROM sessions) AS total_sessions,
                      (SELECT COUNT(*) FROM messages) AS total_messages,
                      (SELECT SUM(total_cost) FROM sessions) AS total_cost,
                      (SELECT SUM(total_tokens_input) FROM sessions) AS total_tokens_input,
                      (SELECT SUM(total_tokens_output) FROM sessions) AS total_tokens_output,
                      (SELECT SUM(total_tokens_reasoning) FROM sessions) AS total_tokens_reasoning,
                      (SELECT SUM(total_cache_read) FROM sessions) AS total_cache_read,
                      (SELECT SUM(total_cache_write) FROM sessions) AS total_cache_write`,
                  )
                  .get() as OverviewRow);

            const totalSessions = row.total_sessions ?? 0;
            const totalMessages = row.total_messages ?? 0;
            const totalCost = row.total_cost ?? 0;

            return {
              totalSessions,
              totalMessages,
              totalCost,
              totalTokensInput: row.total_tokens_input ?? 0,
              totalTokensOutput: row.total_tokens_output ?? 0,
              totalTokensReasoning: row.total_tokens_reasoning ?? 0,
              totalCacheRead: row.total_cache_read ?? 0,
              totalCacheWrite: row.total_cache_write ?? 0,
              avgCostPerSession:
                totalSessions === 0 ? 0 : totalCost / totalSessions,
              avgMessagesPerSession:
                totalSessions === 0 ? 0 : totalMessages / totalSessions,
            } satisfies Overview;
          },
          catch: (cause) =>
            new StatsError({ reason: "Failed to get overview", cause }),
        });

      const getDailyStats = (
        range: DateRange,
        source?: string,
      ): Effect.Effect<DailyStat[], StatsError> =>
        Effect.try({
          try: () => {
            const rows = source
              ? sqlite
                  .query<DailyStatRow, [string, string, string]>(
                    `SELECT date, source, session_count, message_count, total_cost,
                      total_tokens_input, total_tokens_output, total_tokens_reasoning,
                      total_cache_read, total_cache_write
                    FROM daily_stats
                    WHERE date >= ? AND date <= ? AND source = ?
                    ORDER BY date ASC`,
                  )
                  .all(range.start, range.end, source)
              : sqlite
                  .query<DailyStatRow, [string, string]>(
                    `SELECT
                      date,
                      'all' AS source,
                      SUM(session_count) AS session_count,
                      SUM(message_count) AS message_count,
                      SUM(total_cost) AS total_cost,
                      SUM(total_tokens_input) AS total_tokens_input,
                      SUM(total_tokens_output) AS total_tokens_output,
                      SUM(total_tokens_reasoning) AS total_tokens_reasoning,
                      SUM(total_cache_read) AS total_cache_read,
                      SUM(total_cache_write) AS total_cache_write
                    FROM daily_stats
                    WHERE date >= ? AND date <= ?
                    GROUP BY date
                    ORDER BY date ASC`,
                  )
                  .all(range.start, range.end);

            return rows.map(
              (r): DailyStat => ({
                date: r.date,
                source: r.source ?? "opencode",
                sessionCount: r.session_count,
                messageCount: r.message_count,
                totalCost: r.total_cost ?? 0,
                totalTokensInput: r.total_tokens_input ?? 0,
                totalTokensOutput: r.total_tokens_output ?? 0,
                totalTokensReasoning: r.total_tokens_reasoning ?? 0,
                totalCacheRead: r.total_cache_read ?? 0,
                totalCacheWrite: r.total_cache_write ?? 0,
              }),
            );
          },
          catch: (cause) =>
            new StatsError({ reason: "Failed to get daily stats", cause }),
        });

      const getRangeDays = (range: DashboardRangeQueryParam): number => {
        if (range === "7d") return 7;
        if (range === "90d") return 90;
        return 30;
      };

      const getRangeBounds = (range: DashboardRangeQueryParam) => {
        const dayMs = 24 * 60 * 60 * 1000;
        const endMs = Date.now();
        const startMs = endMs - (getRangeDays(range) - 1) * dayMs;
        return {
          startMs,
          endMs,
          startDate: formatDate(startMs),
          endDate: formatDate(endMs),
        };
      };

      const getKpiAggregate = (
        startMs: number,
        endMs: number,
        source?: string,
      ): KpiAggregateRow =>
        source
          ? (sqlite
              .query<KpiAggregateRow, [number, number, string]>(
                `SELECT
                  COUNT(*) AS session_count,
                  SUM(total_cost) AS total_cost,
                  SUM(total_tokens_input) AS total_tokens_input,
                  SUM(total_tokens_output) AS total_tokens_output
                FROM sessions
                WHERE time_updated >= ? AND time_updated <= ? AND source = ?`,
              )
              .get(startMs, endMs, source) as KpiAggregateRow)
          : (sqlite
              .query<KpiAggregateRow, [number, number]>(
                `SELECT
                  COUNT(*) AS session_count,
                  SUM(total_cost) AS total_cost,
                  SUM(total_tokens_input) AS total_tokens_input,
                  SUM(total_tokens_output) AS total_tokens_output
                FROM sessions
                WHERE time_updated >= ? AND time_updated <= ?`,
              )
              .get(startMs, endMs) as KpiAggregateRow);

      const toKpiMetrics = (row: KpiAggregateRow) => {
        const sessions = row.session_count ?? 0;
        const spend = row.total_cost ?? 0;
        const tokensInput = row.total_tokens_input ?? 0;
        const tokensOutput = row.total_tokens_output ?? 0;
        return {
          spend,
          sessions,
          avgCostPerSession: spend / Math.max(sessions, 1),
          outputInputRatio: tokensOutput / Math.max(tokensInput, 1),
        };
      };

      const toDeltaPct = (current: number, previous: number): number | null => {
        if (previous === 0) return null;
        return (current - previous) / previous;
      };

      const getKpiSummary = (params: {
        range: DashboardRangeQueryParam;
        compare: boolean;
        source?: string;
      }): Effect.Effect<KpiSummary, StatsError> =>
        Effect.try({
          try: () => {
            const now = Date.now();
            const dayMs = 24 * 60 * 60 * 1000;
            const rangeDays = getRangeDays(params.range);
            const currentStartMs = now - (rangeDays - 1) * dayMs;
            const previousStartMs = currentStartMs - rangeDays * dayMs;
            const previousEndMs = currentStartMs - 1;

            const current = toKpiMetrics(
              getKpiAggregate(currentStartMs, now, params.source),
            );
            if (!params.compare) {
              return {
                spend: { value: current.spend, deltaPct: null },
                sessions: { value: current.sessions, deltaPct: null },
                avgCostPerSession: {
                  value: current.avgCostPerSession,
                  deltaPct: null,
                },
                outputInputRatio: {
                  value: current.outputInputRatio,
                  deltaPct: null,
                },
              } satisfies KpiSummary;
            }

            const previous = toKpiMetrics(
              getKpiAggregate(previousStartMs, previousEndMs, params.source),
            );

            return {
              spend: {
                value: current.spend,
                deltaPct: toDeltaPct(current.spend, previous.spend),
              },
              sessions: {
                value: current.sessions,
                deltaPct: toDeltaPct(current.sessions, previous.sessions),
              },
              avgCostPerSession: {
                value: current.avgCostPerSession,
                deltaPct: toDeltaPct(
                  current.avgCostPerSession,
                  previous.avgCostPerSession,
                ),
              },
              outputInputRatio: {
                value: current.outputInputRatio,
                deltaPct: toDeltaPct(
                  current.outputInputRatio,
                  previous.outputInputRatio,
                ),
              },
            } satisfies KpiSummary;
          },
          catch: (cause) =>
            new StatsError({ reason: "Failed to get KPI summary", cause }),
        });

      const getTrendSeries = (params: {
        range: DashboardRangeQueryParam;
        source?: string;
      }): Effect.Effect<TrendPoint[], StatsError> =>
        Effect.try({
          try: () => {
            const { startDate: start, endDate: end } = getRangeBounds(
              params.range,
            );

            const rows = params.source
              ? sqlite
                  .query<DailyStatRow, [string, string, string]>(
                    `SELECT date, source, session_count, message_count, total_cost,
                      total_tokens_input, total_tokens_output, total_tokens_reasoning,
                      total_cache_read, total_cache_write
                    FROM daily_stats
                    WHERE date >= ? AND date <= ? AND source = ?
                    ORDER BY date ASC`,
                  )
                  .all(start, end, params.source)
              : sqlite
                  .query<DailyStatRow, [string, string]>(
                    `SELECT
                      date,
                      'all' AS source,
                      SUM(session_count) AS session_count,
                      SUM(message_count) AS message_count,
                      SUM(total_cost) AS total_cost,
                      SUM(total_tokens_input) AS total_tokens_input,
                      SUM(total_tokens_output) AS total_tokens_output,
                      SUM(total_tokens_reasoning) AS total_tokens_reasoning,
                      SUM(total_cache_read) AS total_cache_read,
                      SUM(total_cache_write) AS total_cache_write
                    FROM daily_stats
                    WHERE date >= ? AND date <= ?
                    GROUP BY date
                    ORDER BY date ASC`,
                  )
                  .all(start, end);

            const byDate = new Map(rows.map((row) => [row.date, row]));
            return dateRangeDays(start, end).map((date): TrendPoint => {
              const row = byDate.get(date);
              return {
                date,
                cost: row?.total_cost ?? 0,
                sessions: row?.session_count ?? 0,
                tokensInput: row?.total_tokens_input ?? 0,
                tokensOutput: row?.total_tokens_output ?? 0,
                tokensReasoning: row?.total_tokens_reasoning ?? 0,
              };
            });
          },
          catch: (cause) =>
            new StatsError({ reason: "Failed to get trend series", cause }),
        });

      const getAnomalySeverity = (ratio: number): "low" | "medium" | "high" => {
        if (ratio >= 4) return "high";
        if (ratio >= 3) return "medium";
        return "low";
      };

      const top5PlusOther = (
        items: ReadonlyArray<{
          label: string;
          key: string;
          cost: number;
        }>,
      ): CostShareItem[] => {
        const totalCost = items.reduce((sum, item) => sum + item.cost, 0);
        const toShare = (cost: number): number =>
          totalCost <= 0 ? 0 : (cost / totalCost) * 100;

        const top = items.slice(0, 5).map(
          (item): CostShareItem => ({
            label: item.label,
            key: item.key,
            cost: item.cost,
            sharePct: toShare(item.cost),
          }),
        );

        if (items.length <= 5) {
          return top;
        }

        const otherCost = items
          .slice(5)
          .reduce((sum, item) => sum + item.cost, 0);

        return [
          ...top,
          {
            label: "Other",
            key: "other",
            cost: otherCost,
            sharePct: toShare(otherCost),
          },
        ];
      };

      const getProjectCostShare = (params: {
        range: DashboardRangeQueryParam;
      }): Effect.Effect<CostShareItem[], StatsError> =>
        Effect.try({
          try: () => {
            const { startMs, endMs } = getRangeBounds(params.range);
            const rows = sqlite
              .query<ProjectCostShareRow, [number, number]>(
                `SELECT
                   project_id,
                   project_name,
                   SUM(total_cost) AS total_cost
                 FROM sessions
                 WHERE time_updated >= ? AND time_updated <= ?
                 GROUP BY project_id, project_name
                 ORDER BY total_cost DESC, project_id ASC`,
              )
              .all(startMs, endMs);

            return top5PlusOther(
              rows.map((row) => ({
                label: formatProjectName(row.project_name, row.project_id),
                key: row.project_id,
                cost: row.total_cost ?? 0,
              })),
            );
          },
          catch: (cause) =>
            new StatsError({
              reason: "Failed to get project cost share",
              cause,
            }),
        });

      const getModelCostShare = (params: {
        range: DashboardRangeQueryParam;
      }): Effect.Effect<CostShareItem[], StatsError> =>
        Effect.try({
          try: () => {
            const { startMs, endMs } = getRangeBounds(params.range);
            const rows = sqlite
              .query<ModelCostShareRow, [number, number]>(
                `SELECT
                   provider_id,
                   model_id,
                   SUM(cost) AS total_cost
                 FROM messages
                 WHERE role = 'assistant'
                   AND model_id IS NOT NULL
                   AND time_created >= ? AND time_created <= ?
                 GROUP BY provider_id, model_id
                 ORDER BY total_cost DESC, model_id ASC, provider_id ASC`,
              )
              .all(startMs, endMs);

            return top5PlusOther(
              rows.map((row) => {
                const provider = row.provider_id ?? "unknown";
                return {
                  label: row.model_id,
                  key: `${provider}:${row.model_id}`,
                  cost: row.total_cost ?? 0,
                };
              }),
            );
          },
          catch: (cause) =>
            new StatsError({ reason: "Failed to get model cost share", cause }),
        });

      const getAnomalies = (params: {
        range: DashboardRangeQueryParam;
        source?: string;
      }): Effect.Effect<AnomalyItem[], StatsError> =>
        Effect.try({
          try: () => {
            const { startMs, endMs, startDate, endDate } = getRangeBounds(
              params.range,
            );

            const costRows = params.source
              ? sqlite
                  .query<DailyCostRow, [string, string, string]>(
                    `SELECT date, total_cost
                     FROM daily_stats
                     WHERE date >= ? AND date <= ? AND source = ?
                     ORDER BY date ASC`,
                  )
                  .all(startDate, endDate, params.source)
              : sqlite
                  .query<DailyCostRow, [string, string]>(
                    `SELECT date, SUM(total_cost) AS total_cost
                     FROM daily_stats
                     WHERE date >= ? AND date <= ?
                     GROUP BY date
                     ORDER BY date ASC`,
                  )
                  .all(startDate, endDate);

            const anomalies: AnomalyItem[] = [];

            for (let i = 1; i < costRows.length; i++) {
              const current = costRows[i];
              const previous = costRows[i - 1];
              const currentCost = current?.total_cost ?? 0;
              const previousCost = previous?.total_cost ?? 0;
              if (previousCost <= 0) continue;

              const ratio = currentCost / previousCost;
              if (ratio < 2) continue;

              anomalies.push({
                type: "cost_spike",
                date: current?.date ?? "",
                severity: getAnomalySeverity(ratio),
                message: `Daily spend jumped ${ratio.toFixed(1)}x day-over-day`,
                href: `/daily/${current?.date ?? ""}`,
              });
            }

            const modelRows = params.source
              ? sqlite
                  .query<ModelDailyCostRow, [number, number, string]>(
                    `SELECT
                       date(time_created / 1000, 'unixepoch') AS date,
                       provider_id,
                       model_id,
                       SUM(cost) AS total_cost
                     FROM messages
                     WHERE role = 'assistant'
                       AND model_id IS NOT NULL
                       AND time_created >= ?
                       AND time_created <= ?
                       AND source = ?
                     GROUP BY date, provider_id, model_id
                     ORDER BY model_id ASC, provider_id ASC, date ASC`,
                  )
                  .all(startMs, endMs, params.source)
              : sqlite
                  .query<ModelDailyCostRow, [number, number]>(
                    `SELECT
                       date(time_created / 1000, 'unixepoch') AS date,
                       provider_id,
                       model_id,
                       SUM(cost) AS total_cost
                     FROM messages
                     WHERE role = 'assistant'
                       AND model_id IS NOT NULL
                       AND time_created >= ?
                       AND time_created <= ?
                     GROUP BY date, provider_id, model_id
                     ORDER BY model_id ASC, provider_id ASC, date ASC`,
                  )
                  .all(startMs, endMs);

            const previousByModel = new Map<string, number>();
            for (const row of modelRows) {
              const key = `${row.provider_id ?? "unknown"}:${row.model_id}`;
              const previousCost = previousByModel.get(key) ?? 0;
              const currentCost = row.total_cost ?? 0;

              if (previousCost > 0) {
                const ratio = currentCost / previousCost;
                if (ratio >= 2) {
                  anomalies.push({
                    type: "model_spike",
                    date: row.date,
                    severity: getAnomalySeverity(ratio),
                    message: `${row.model_id} spend jumped ${ratio.toFixed(1)}x day-over-day`,
                    href: `/daily/${row.date}`,
                  });
                }
              }

              previousByModel.set(key, currentCost);
            }

            return anomalies.sort((a, b) => b.date.localeCompare(a.date));
          },
          catch: (cause) =>
            new StatsError({ reason: "Failed to get anomalies", cause }),
        });

      const getExpensiveSessions = (params: {
        range: DashboardRangeQueryParam;
        source?: string;
      }): Effect.Effect<ExpensiveSessionItem[], StatsError> =>
        Effect.try({
          try: () => {
            const { startMs, endMs } = getRangeBounds(params.range);

            const rows = params.source
              ? sqlite
                  .query<ExpensiveSessionRow, [number, number, string]>(
                    `SELECT
                       id,
                       title,
                       total_cost,
                       date(time_updated / 1000, 'unixepoch') AS date
                     FROM sessions
                     WHERE time_updated >= ? AND time_updated <= ? AND source = ?
                     ORDER BY total_cost DESC, time_updated DESC
                     LIMIT 5`,
                  )
                  .all(startMs, endMs, params.source)
              : sqlite
                  .query<ExpensiveSessionRow, [number, number]>(
                    `SELECT
                       id,
                       title,
                       total_cost,
                       date(time_updated / 1000, 'unixepoch') AS date
                     FROM sessions
                     WHERE time_updated >= ? AND time_updated <= ?
                     ORDER BY total_cost DESC, time_updated DESC
                     LIMIT 5`,
                  )
                  .all(startMs, endMs);

            return rows.map(
              (row): ExpensiveSessionItem => ({
                sessionId: row.id,
                title: row.title ?? "",
                totalCost: row.total_cost ?? 0,
                date: row.date,
                href: `/sessions/${row.id}`,
              }),
            );
          },
          catch: (cause) =>
            new StatsError({
              reason: "Failed to get expensive sessions",
              cause,
            }),
        });

      const getModelBreakdown = (): Effect.Effect<ModelStat[], StatsError> =>
        Effect.try({
          try: () => {
            const rows = sqlite
              .query<ModelStatRow, []>(
                `SELECT
                  provider_id,
                  model_id,
                  COUNT(*) AS message_count,
                  SUM(cost) AS total_cost,
                  SUM(tokens_input) AS total_tokens_input,
                  SUM(tokens_output) AS total_tokens_output
                FROM messages
                WHERE role = 'assistant' AND model_id IS NOT NULL
                GROUP BY provider_id, model_id
                ORDER BY total_cost DESC`,
              )
              .all();

            return rows.map(
              (r): ModelStat => ({
                providerId: r.provider_id,
                modelId: r.model_id,
                messageCount: r.message_count,
                totalCost: r.total_cost ?? 0,
                totalTokensInput: r.total_tokens_input ?? 0,
                totalTokensOutput: r.total_tokens_output ?? 0,
              }),
            );
          },
          catch: (cause) =>
            new StatsError({ reason: "Failed to get model breakdown", cause }),
        });

      const getProjectBreakdown = (): Effect.Effect<
        ProjectStat[],
        StatsError
      > =>
        Effect.try({
          try: () => {
            const rows = sqlite
              .query<ProjectStatRow, []>(
                `SELECT
                  project_id,
                  project_name,
                  COUNT(*) AS session_count,
                  SUM(total_cost) AS total_cost,
                  SUM(total_tokens_input) AS total_tokens_input,
                  SUM(total_tokens_output) AS total_tokens_output
                FROM sessions
                GROUP BY project_id, project_name
                ORDER BY total_cost DESC`,
              )
              .all();

            return rows.map(
              (r): ProjectStat => ({
                projectId: r.project_id,
                projectName: r.project_name,
                sessionCount: r.session_count,
                totalCost: r.total_cost ?? 0,
                totalTokensInput: r.total_tokens_input ?? 0,
                totalTokensOutput: r.total_tokens_output ?? 0,
              }),
            );
          },
          catch: (cause) =>
            new StatsError({
              reason: "Failed to get project breakdown",
              cause,
            }),
        });

      const getSessionsForDate = (
        date: string,
      ): Effect.Effect<SessionSummary[], StatsError> =>
        Effect.try({
          try: () => {
            const rows = sqlite
              .query<SessionRow, [string]>(
                `SELECT id, source, project_id, project_name, title, message_count,
                  total_cost, total_tokens_input, total_tokens_output,
                  total_tokens_reasoning, total_cache_read, total_cache_write,
                  time_created, time_updated
                FROM sessions
                WHERE date(time_updated / 1000, 'unixepoch') = ?
                ORDER BY time_updated ASC`,
              )
              .all(date);

            return rows.map(
              (r): SessionSummary => ({
                id: r.id,
                source: r.source ?? "opencode",
                projectId: r.project_id,
                projectName: formatProjectName(r.project_name, r.project_id),
                title: r.title ?? "",
                messageCount: r.message_count ?? 0,
                totalCost: r.total_cost ?? 0,
                totalTokensInput: r.total_tokens_input ?? 0,
                totalTokensOutput: r.total_tokens_output ?? 0,
                totalTokensReasoning: r.total_tokens_reasoning ?? 0,
                totalCacheRead: r.total_cache_read ?? 0,
                totalCacheWrite: r.total_cache_write ?? 0,
                timeCreated: r.time_created ?? 0,
                timeUpdated: r.time_updated ?? 0,
              }),
            );
          },
          catch: (cause) =>
            new StatsError({
              reason: "Failed to get sessions for date",
              cause,
            }),
        });

      const getSessions = (params: {
        projectId?: string;
        source?: string;
      }): Effect.Effect<SessionSummary[], StatsError> =>
        Effect.try({
          try: () => {
            const rows =
              params.projectId && params.source
                ? sqlite
                    .query<SessionRow, [string, string]>(
                      `SELECT id, source, project_id, project_name, title, message_count,
                      total_cost, total_tokens_input, total_tokens_output,
                      total_tokens_reasoning, total_cache_read, total_cache_write,
                      time_created, time_updated
                    FROM sessions
                    WHERE project_id = ? AND source = ?
                    ORDER BY time_updated DESC`,
                    )
                    .all(params.projectId, params.source)
                : params.projectId
                  ? sqlite
                      .query<SessionRow, [string]>(
                        `SELECT id, source, project_id, project_name, title, message_count,
                        total_cost, total_tokens_input, total_tokens_output,
                        total_tokens_reasoning, total_cache_read, total_cache_write,
                        time_created, time_updated
                      FROM sessions
                      WHERE project_id = ?
                      ORDER BY time_updated DESC`,
                      )
                      .all(params.projectId)
                  : params.source
                    ? sqlite
                        .query<SessionRow, [string]>(
                          `SELECT id, source, project_id, project_name, title, message_count,
                          total_cost, total_tokens_input, total_tokens_output,
                          total_tokens_reasoning, total_cache_read, total_cache_write,
                          time_created, time_updated
                        FROM sessions
                        WHERE source = ?
                        ORDER BY time_updated DESC`,
                        )
                        .all(params.source)
                    : sqlite
                        .query<SessionRow, []>(
                          `SELECT id, source, project_id, project_name, title, message_count,
                          total_cost, total_tokens_input, total_tokens_output,
                          total_tokens_reasoning, total_cache_read, total_cache_write,
                          time_created, time_updated
                        FROM sessions
                        ORDER BY time_updated DESC`,
                        )
                        .all();

            return rows.map(
              (r): SessionSummary => ({
                id: r.id,
                source: r.source ?? "opencode",
                projectId: r.project_id,
                projectName: formatProjectName(r.project_name, r.project_id),
                title: r.title ?? "",
                messageCount: r.message_count ?? 0,
                totalCost: r.total_cost ?? 0,
                totalTokensInput: r.total_tokens_input ?? 0,
                totalTokensOutput: r.total_tokens_output ?? 0,
                totalTokensReasoning: r.total_tokens_reasoning ?? 0,
                totalCacheRead: r.total_cache_read ?? 0,
                totalCacheWrite: r.total_cache_write ?? 0,
                timeCreated: r.time_created ?? 0,
                timeUpdated: r.time_updated ?? 0,
              }),
            );
          },
          catch: (cause) =>
            new StatsError({ reason: "Failed to get sessions", cause }),
        });

      return {
        getOverview,
        getDailyStats,
        getKpiSummary,
        getTrendSeries,
        getProjectCostShare,
        getModelCostShare,
        getAnomalies,
        getExpensiveSessions,
        getModelBreakdown,
        getProjectBreakdown,
        getSessionsForDate,
        getSessions,
      };
    }),
  );
