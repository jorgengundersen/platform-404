import { Effect } from "effect";

import { DashboardDb, type DashboardDbError } from "@/services/dashboard-db";

/**
 * statsOverviewHandler - Returns overview stats from dashboard database.
 * Requires DashboardDb in context.
 */
export const statsOverviewHandler = (
  _req: Request,
): Effect.Effect<Response, DashboardDbError, DashboardDb> =>
  Effect.gen(function* () {
    const { sqlite } = yield* DashboardDb;

    const result = sqlite
      .query("SELECT COUNT(DISTINCT id) as total FROM sessions")
      .get() as { total: number } | null;

    const totalSessions = result?.total ?? 0;

    return new Response(
      JSON.stringify({
        data: {
          totalSessions,
        },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  });
