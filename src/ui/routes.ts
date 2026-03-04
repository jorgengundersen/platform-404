import { readFileSync } from "node:fs";
import { join } from "node:path";

import { Effect } from "effect";

import { DashboardDb } from "@/services/dashboard-db";
import { StatsService } from "@/services/stats";
import { dashboard } from "@/ui/templates/dashboard";
import { modelsPage } from "@/ui/templates/models";
import { page } from "@/ui/templates/page";
import { projectsPage } from "@/ui/templates/projects";
import { sessionDetail } from "@/ui/templates/session-detail";

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

interface MessageRow {
  id: string;
  session_id: string;
  role: string;
  provider_id: string | null;
  model_id: string | null;
  cost: number | null;
  tokens_input: number | null;
  tokens_output: number | null;
  tokens_reasoning: number | null;
  time_created: number | null;
}

function todayMinus(days: number): string {
  const d = new Date(Date.now() - days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

export const rootHandler = (
  _req: Request,
): Effect.Effect<Response, never, StatsService | DashboardDb> =>
  Effect.gen(function* () {
    const stats = yield* StatsService;
    const { sqlite } = yield* DashboardDb;

    const overview = yield* stats
      .getOverview()
      .pipe(Effect.catchAll(() => Effect.succeed(null)));

    const daily = yield* stats
      .getDailyStats({ start: todayMinus(30), end: todayMinus(0) })
      .pipe(Effect.catchAll(() => Effect.succeed([])));

    const rows = sqlite
      .query<SessionRow, [number]>(
        `SELECT id, project_id, project_name, title, message_count,
          total_cost, total_tokens_input, total_tokens_output,
          total_tokens_reasoning, total_cache_read, total_cache_write,
          time_created, time_updated
        FROM sessions
        ORDER BY time_updated DESC
        LIMIT ?`,
      )
      .all(50);

    const sessions = rows.map((r) => ({
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
    }));

    const emptyOverview = {
      totalSessions: 0,
      totalMessages: 0,
      totalCost: 0,
      totalTokensInput: 0,
      totalTokensOutput: 0,
      totalTokensReasoning: 0,
      totalCacheRead: 0,
      totalCacheWrite: 0,
      avgCostPerSession: 0,
      avgMessagesPerSession: 0,
    };

    const html = page(
      "platform-404",
      dashboard(overview ?? emptyOverview, daily, sessions),
    );

    return new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  });

export const sessionPageHandler = (
  _req: Request,
  id: string,
): Effect.Effect<Response, never, DashboardDb> =>
  Effect.gen(function* () {
    const { sqlite } = yield* DashboardDb;

    const sessionRow = sqlite
      .query<SessionRow, [string]>(
        `SELECT id, project_id, project_name, title, message_count,
          total_cost, total_tokens_input, total_tokens_output,
          total_tokens_reasoning, total_cache_read, total_cache_write,
          time_created, time_updated
        FROM sessions
        WHERE id = ?`,
      )
      .get(id) as SessionRow | null;

    if (!sessionRow) {
      return new Response(
        page("404 – platform-404", "<main><p>Session not found.</p></main>"),
        {
          status: 404,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        },
      );
    }

    const messageRows = sqlite
      .query<MessageRow, [string]>(
        `SELECT id, session_id, role, provider_id, model_id, cost,
          tokens_input, tokens_output, tokens_reasoning, time_created
        FROM messages
        WHERE session_id = ?
        ORDER BY time_created ASC`,
      )
      .all(id);

    const session = {
      id: sessionRow.id,
      projectId: sessionRow.project_id,
      projectName: sessionRow.project_name ?? "",
      title: sessionRow.title ?? "",
      messageCount: sessionRow.message_count ?? 0,
      totalCost: sessionRow.total_cost ?? 0,
      totalTokensInput: sessionRow.total_tokens_input ?? 0,
      totalTokensOutput: sessionRow.total_tokens_output ?? 0,
      totalTokensReasoning: sessionRow.total_tokens_reasoning ?? 0,
      totalCacheRead: sessionRow.total_cache_read ?? 0,
      totalCacheWrite: sessionRow.total_cache_write ?? 0,
      timeCreated: sessionRow.time_created ?? 0,
      timeUpdated: sessionRow.time_updated ?? 0,
    };

    const messages = messageRows.map((m) => ({
      id: m.id,
      sessionId: m.session_id,
      role: m.role,
      providerId: m.provider_id ?? null,
      modelId: m.model_id ?? null,
      cost: m.cost ?? 0,
      tokensInput: m.tokens_input ?? 0,
      tokensOutput: m.tokens_output ?? 0,
      tokensReasoning: m.tokens_reasoning ?? 0,
      timeCreated: m.time_created ?? 0,
    }));

    const html = page(
      `${session.title || session.id} – platform-404`,
      sessionDetail(session, messages),
    );

    return new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  });

export async function staticStylesHandler(_req: Request): Promise<Response> {
  const cssPath = join(import.meta.dir, "static", "styles.css");
  const css = readFileSync(cssPath, "utf-8");
  return new Response(css, {
    status: 200,
    headers: {
      "Content-Type": "text/css",
    },
  });
}

export const modelsPageHandler = (
  _req: Request,
): Effect.Effect<Response, never, StatsService> =>
  Effect.gen(function* () {
    const stats = yield* StatsService;

    const models = yield* stats
      .getModelBreakdown()
      .pipe(Effect.catchAll(() => Effect.succeed([])));

    const html = page("Models – platform-404", modelsPage(models));

    return new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  });

export const projectsPageHandler = (
  _req: Request,
): Effect.Effect<Response, never, StatsService> =>
  Effect.gen(function* () {
    const stats = yield* StatsService;

    const projects = yield* stats
      .getProjectBreakdown()
      .pipe(Effect.catchAll(() => Effect.succeed([])));

    const html = page("Projects – platform-404", projectsPage(projects));

    return new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  });
