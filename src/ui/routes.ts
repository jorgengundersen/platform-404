import { readFileSync } from "node:fs";
import { join } from "node:path";

import { Effect } from "effect";

import { decodeDashboardRootQueryParams } from "@/primitives/schemas/api-params";
import { DashboardDb } from "@/services/dashboard-db";
import { StatsService } from "@/services/stats";
import { dailyDetailPage } from "@/ui/templates/daily-detail";
import { dashboard } from "@/ui/templates/dashboard";
import { modelsPage } from "@/ui/templates/models";
import { escapeHtml, page } from "@/ui/templates/page";
import { projectsPage } from "@/ui/templates/projects";
import { sessionDetail } from "@/ui/templates/session-detail";
import { sessionsPage } from "@/ui/templates/sessions-list";

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

export const rootHandler = (
  req: Request,
): Effect.Effect<Response, never, StatsService | DashboardDb> =>
  Effect.gen(function* () {
    const url = new URL(req.url);
    const { range, compare } = decodeDashboardRootQueryParams({
      range: url.searchParams.get("range") ?? undefined,
      compare: url.searchParams.get("compare") ?? undefined,
    });

    const stats = yield* StatsService;
    const { sqlite } = yield* DashboardDb;

    const [
      overview,
      projects,
      models,
      kpis,
      trends,
      projectCostShare,
      modelCostShare,
      anomalies,
      expensiveSessions,
    ] = yield* Effect.all(
      [
        stats.getOverview().pipe(Effect.catchAll(() => Effect.succeed(null))),
        stats
          .getProjectBreakdown()
          .pipe(Effect.catchAll(() => Effect.succeed([]))),
        stats
          .getModelBreakdown()
          .pipe(Effect.catchAll(() => Effect.succeed([]))),
        stats
          .getKpiSummary({ range, compare: compare === "1" })
          .pipe(Effect.catchAll(() => Effect.succeed(null))),
        stats
          .getTrendSeries({ range })
          .pipe(Effect.catchAll(() => Effect.succeed([]))),
        stats
          .getProjectCostShare({ range })
          .pipe(Effect.catchAll(() => Effect.succeed([]))),
        stats
          .getModelCostShare({ range })
          .pipe(Effect.catchAll(() => Effect.succeed([]))),
        stats
          .getAnomalies({ range })
          .pipe(Effect.catchAll(() => Effect.succeed([]))),
        stats
          .getExpensiveSessions({ range })
          .pipe(Effect.catchAll(() => Effect.succeed([]))),
      ],
      { concurrency: "unbounded" },
    );

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
      .all(5);

    const sessions = rows.map((r) => ({
      id: r.id,
      projectId: r.project_id,
      projectName: r.project_name || r.project_id.slice(0, 8),
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
      dashboard(overview ?? emptyOverview, sessions, projects, models, {
        range,
        compare: compare === "1",
        kpis,
        trends,
        projectCostShare,
        modelCostShare,
        anomalies,
        expensiveSessions,
      }),
      "/",
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
        page(
          "404 – platform-404",
          "<main><p>Session not found.</p></main>",
          "/sessions",
        ),
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
      projectName: sessionRow.project_name || sessionRow.project_id.slice(0, 8),
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
      "/sessions",
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

export async function staticFaviconHandler(_req: Request): Promise<Response> {
  const faviconPath = join(import.meta.dir, "static", "favicon.svg");
  const favicon = readFileSync(faviconPath, "utf-8");
  return new Response(favicon, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml",
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

    const html = page("Models – platform-404", modelsPage(models), "/models");

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

    const html = page(
      "Projects – platform-404",
      projectsPage(projects),
      "/projects",
    );

    return new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  });

export const sessionsListPageHandler = (
  req: Request,
): Effect.Effect<Response, never, StatsService> =>
  Effect.gen(function* () {
    const url = new URL(req.url);
    const pageNum = Math.max(
      1,
      parseInt(url.searchParams.get("page") ?? "1", 10) || 1,
    );
    const limitRaw = parseInt(url.searchParams.get("limit") ?? "50", 10);
    const limit = Math.min(
      100,
      Math.max(1, Number.isNaN(limitRaw) ? 50 : limitRaw),
    );
    const projectFilter = url.searchParams.get("project") ?? null;

    const stats = yield* StatsService;

    const sessions = yield* stats
      .getSessions(projectFilter ? { projectId: projectFilter } : {})
      .pipe(Effect.catchAll(() => Effect.succeed([])));

    const total = sessions.length;
    const lastPage = Math.ceil(total / limit) || 1;
    const clampedPage = Math.min(pageNum, lastPage);
    const offset = (clampedPage - 1) * limit;
    const pageSessions = sessions.slice(offset, offset + limit);

    const html = page(
      "Sessions – platform-404",
      sessionsPage({
        sessions: pageSessions,
        page: clampedPage,
        total,
        limit,
        projectFilter,
      }),
      "/sessions",
    );

    return new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  });

export function notFoundPage(path: string): string {
  return page(
    "404 Not Found – platform-404",
    `<main class="container">
  <div class="card" style="text-align:center;padding:3rem 2rem;">
    <h1 style="font-size:4rem;margin:0;color:var(--text-muted)">404</h1>
    <p style="font-size:1.25rem;margin:0.5rem 0 1.5rem">Page not found</p>
    <p style="color:var(--text-muted);font-family:monospace">${escapeHtml(path)}</p>
    <a href="/" class="btn" style="display:inline-block;margin-top:1rem">&larr; Back to dashboard</a>
  </div>
</main>`,
  );
}

export const notFoundHandler = (req: Request): Response => {
  const url = new URL(req.url);
  return new Response(notFoundPage(url.pathname), {
    status: 404,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
};

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const dailyDetailPageHandler = (
  _req: Request,
  date: string,
): Effect.Effect<Response, never, StatsService> =>
  Effect.gen(function* () {
    if (!DATE_REGEX.test(date)) {
      return new Response(
        `Invalid date format. Expected YYYY-MM-DD, got: ${date}`,
        {
          status: 400,
        },
      );
    }

    const stats = yield* StatsService;

    const [dailyStats, sessions] = yield* Effect.all(
      [
        stats
          .getDailyStats({ start: date, end: date })
          .pipe(Effect.catchAll(() => Effect.succeed([]))),
        stats
          .getSessionsForDate(date)
          .pipe(Effect.catchAll(() => Effect.succeed([]))),
      ],
      { concurrency: "unbounded" },
    );

    const stat = dailyStats.length > 0 ? (dailyStats[0] ?? null) : null;

    const html = page(
      `${date} – platform-404`,
      dailyDetailPage({ date, stat, sessions }),
      "/",
    );

    return new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  });
