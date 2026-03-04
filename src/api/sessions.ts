import { Effect } from "effect";

import { DashboardDb } from "@/services/dashboard-db";

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
// Row types
// ---------------------------------------------------------------------------

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

interface CountRow {
  total: number;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * sessionsListHandler - GET /api/sessions
 * Query params: page (default 1), limit (default 20)
 */
export const sessionsListHandler = (
  req: Request,
): Effect.Effect<Response, never, DashboardDb> =>
  Effect.gen(function* () {
    const url = new URL(req.url);
    const pageRaw = url.searchParams.get("page") ?? "1";
    const limitRaw = url.searchParams.get("limit") ?? "20";

    const page = Number(pageRaw);
    const limit = Number(limitRaw);

    if (!Number.isInteger(page) || page < 1 || Number.isNaN(page)) {
      return jsonError("page must be a positive integer");
    }
    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100 ||
      Number.isNaN(limit)
    ) {
      return jsonError("limit must be an integer between 1 and 100");
    }

    const offset = (page - 1) * limit;
    const { sqlite } = yield* DashboardDb;

    const countRow = sqlite
      .query<CountRow, []>("SELECT COUNT(*) AS total FROM sessions")
      .get() as CountRow;

    const rows = sqlite
      .query<SessionRow, [number, number]>(
        `SELECT id, project_id, project_name, title, message_count,
          total_cost, total_tokens_input, total_tokens_output,
          total_tokens_reasoning, total_cache_read, total_cache_write,
          time_created, time_updated
        FROM sessions
        ORDER BY time_updated DESC
        LIMIT ? OFFSET ?`,
      )
      .all(limit, offset);

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

    return jsonOk({ sessions, total: countRow.total, page });
  });

/**
 * sessionDetailHandler - GET /api/sessions/:id
 * Returns session detail with messages array, or 404.
 */
export const sessionDetailHandler = (
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
      return jsonError("Session not found", 404);
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

    return jsonOk({ session, messages });
  });
