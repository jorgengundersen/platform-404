import { openDashboardDb } from "@/services/dashboard-db";

/**
 * statsOverviewHandler - Returns overview stats from dashboard database
 *
 * @param _req - HTTP request
 * @param dbPath - Optional path to dashboard database (defaults to standard path)
 * @returns JSON response with totalSessions count
 */
export async function statsOverviewHandler(
  _req: Request,
  dbPath?: string,
): Promise<Response> {
  const db = openDashboardDb(dbPath);

  try {
    // Query total session count (using DISTINCT to handle malformed schemas with duplicate ids)
    const result = db
      .query("SELECT COUNT(DISTINCT id) as total FROM sessions")
      .get() as {
      total: number;
    } | null;

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
  } finally {
    db.close();
  }
}
