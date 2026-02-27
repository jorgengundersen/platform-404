import { openDashboardDb } from "@/services/dashboard-db";

/**
 * healthHandler - Returns health status with last sync timestamp
 *
 * @param _req - HTTP request
 * @param dbPath - Optional path to dashboard database (defaults to standard path)
 * @returns JSON response with status and lastSync timestamp
 */
export async function healthHandler(
  _req: Request,
  dbPath?: string,
): Promise<Response> {
  const db = openDashboardDb(dbPath);

  try {
    // Fetch lastSync from the database
    const cursor = db
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
  } finally {
    db.close();
  }
}
