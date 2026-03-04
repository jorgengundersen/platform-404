import { Effect } from "effect";

import { DashboardDb, type DashboardDbError } from "@/services/dashboard-db";

/**
 * healthHandler - Returns health status with last sync timestamp.
 * Requires DashboardDb in context.
 */
export const healthHandler = (
  _req: Request,
): Effect.Effect<Response, DashboardDbError, DashboardDb> =>
  Effect.gen(function* () {
    const { sqlite } = yield* DashboardDb;

    const cursor = sqlite
      .query("SELECT last_synced_at FROM ingestion_cursor WHERE source = ?")
      .get("opencode_session") as { last_synced_at: number } | null;

    const lastSync = cursor?.last_synced_at ?? null;

    return new Response(
      JSON.stringify({
        data: {
          status: "ok",
          lastSync,
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
