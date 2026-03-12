import { Effect } from "effect";

import { DashboardDb, type DashboardDbError } from "@/services/dashboard-db";

type CursorRow = {
  source: string;
  last_time_updated: number;
  last_synced_at: number;
};

/**
 * healthHandler - Returns health status with per-source sync status.
 * Requires DashboardDb in context.
 */
export const healthHandler = (
  _req: Request,
): Effect.Effect<Response, DashboardDbError, DashboardDb> =>
  Effect.gen(function* () {
    const { sqlite } = yield* DashboardDb;

    const rows = sqlite
      .query(
        "SELECT source, last_time_updated, last_synced_at FROM ingestion_cursor",
      )
      .all() as CursorRow[];

    const sources: Record<
      string,
      { lastUpdated: number; lastSyncedAt: number }
    > = {};
    for (const row of rows) {
      sources[row.source] = {
        lastUpdated: row.last_time_updated,
        lastSyncedAt: row.last_synced_at,
      };
    }

    return new Response(
      JSON.stringify({
        data: {
          status: "ok",
          sources,
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
