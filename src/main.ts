import { Effect } from "effect";

import { healthHandler } from "@/api/health";
import { statsOverviewHandler } from "@/api/stats";
import { getConfig } from "@/config";
import { getPort } from "@/primitives/port";
import { DashboardDbLive } from "@/services/dashboard-db";
import { rootHandler, staticStylesHandler } from "@/ui/routes";

/**
 * boot - Starts the web server
 *
 * Composition root: wires all handlers and starts listening on PORT.
 * Pure function with no side effects on import.
 */
export async function boot(): Promise<void> {
  // Fail fast on missing/invalid required config.
  const config = getConfig();
  const port = getPort();

  const dashboardDbLayer = DashboardDbLive(config.dashboardDbPath);

  const server = Bun.serve({
    port,
    async fetch(req: Request): Promise<Response> {
      const url = new URL(req.url);

      if (url.pathname === "/api/health") {
        return Effect.runPromise(
          healthHandler(req).pipe(Effect.provide(dashboardDbLayer)),
        );
      }

      if (url.pathname === "/api/stats/overview") {
        return Effect.runPromise(
          statsOverviewHandler(req).pipe(Effect.provide(dashboardDbLayer)),
        );
      }

      if (url.pathname === "/static/styles.css") {
        return staticStylesHandler(req);
      }

      if (url.pathname === "/") {
        return rootHandler(req);
      }

      return new Response("Not Found", { status: 404 });
    },
  });

  console.log(`Server running on http://localhost:${server.port}`);
}
