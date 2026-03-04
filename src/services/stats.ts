import { Context, Data, Effect, Layer } from "effect";
import type { SessionSummary } from "@/primitives/schemas/session-summary";
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

// ---------------------------------------------------------------------------
// Service interface
// ---------------------------------------------------------------------------

export class StatsService extends Context.Tag("StatsService")<
  StatsService,
  {
    readonly getOverview: () => Effect.Effect<Overview, StatsError>;
    readonly getDailyStats: (
      range: DateRange,
    ) => Effect.Effect<DailyStat[], StatsError>;
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

// ---------------------------------------------------------------------------
// Layer
// ---------------------------------------------------------------------------

export const StatsServiceLive: Layer.Layer<StatsService, never, DashboardDb> =
  Layer.effect(
    StatsService,
    Effect.gen(function* () {
      const { sqlite } = yield* DashboardDb;

      const getOverview = (): Effect.Effect<Overview, StatsError> =>
        Effect.try({
          try: () => {
            const row = sqlite
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
              .get() as OverviewRow;

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
      ): Effect.Effect<DailyStat[], StatsError> =>
        Effect.try({
          try: () => {
            const rows = sqlite
              .query<DailyStatRow, [string, string]>(
                `SELECT date, session_count, message_count, total_cost,
                  total_tokens_input, total_tokens_output, total_tokens_reasoning,
                  total_cache_read, total_cache_write
                FROM daily_stats
                WHERE date >= ? AND date <= ?
                ORDER BY date ASC`,
              )
              .all(range.start, range.end);

            return rows.map(
              (r): DailyStat => ({
                date: r.date,
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
                `SELECT id, project_id, project_name, title, message_count,
                  total_cost, total_tokens_input, total_tokens_output,
                  total_tokens_reasoning, total_cache_read, total_cache_write,
                  time_created, time_updated
                FROM sessions
                WHERE date(time_created / 1000, 'unixepoch') = ?
                ORDER BY time_created ASC`,
              )
              .all(date);

            return rows.map(
              (r): SessionSummary => ({
                id: r.id,
                projectId: r.project_id,
                projectName: r.project_name ?? "",
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
      }): Effect.Effect<SessionSummary[], StatsError> =>
        Effect.try({
          try: () => {
            const rows = params.projectId
              ? sqlite
                  .query<SessionRow, [string]>(
                    `SELECT id, project_id, project_name, title, message_count,
                      total_cost, total_tokens_input, total_tokens_output,
                      total_tokens_reasoning, total_cache_read, total_cache_write,
                      time_created, time_updated
                    FROM sessions
                    WHERE project_id = ?
                    ORDER BY time_updated DESC`,
                  )
                  .all(params.projectId)
              : sqlite
                  .query<SessionRow, []>(
                    `SELECT id, project_id, project_name, title, message_count,
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
                projectId: r.project_id,
                projectName: r.project_name ?? "",
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
        getModelBreakdown,
        getProjectBreakdown,
        getSessionsForDate,
        getSessions,
      };
    }),
  );
