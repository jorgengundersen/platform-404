import { healthHandler } from "@/api/health";
import { rootHandler, staticStylesHandler } from "@/ui/routes";
import { getPort } from "@/primitives/port";

/**
 * boot - Starts the web server
 *
 * Composition root: wires all handlers and starts listening on PORT.
 * Pure function with no side effects on import.
 */
export async function boot(): Promise<void> {
  const port = getPort();

  const server = Bun.serve({
    port,
    fetch(req: Request): Response | Promise<Response> {
      const url = new URL(req.url);

      if (url.pathname === "/api/health") {
        return healthHandler(req);
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
