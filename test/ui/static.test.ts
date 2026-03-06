import { describe, expect, test } from "bun:test";

import { staticStylesHandler } from "@/ui/routes";

describe("GET /static/styles.css", () => {
  test("returns 200 CSS with marker /* platform-404 */", async () => {
    const req = new Request("http://localhost:3000/static/styles.css", {
      method: "GET",
    });
    const response = await staticStylesHandler(req);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/css");

    const body = await response.text();
    expect(body).toContain("/* platform-404 */");
  });

  test("serves dark theme CSS variables from file", async () => {
    const req = new Request("http://localhost:3000/static/styles.css", {
      method: "GET",
    });
    const response = await staticStylesHandler(req);
    const body = await response.text();
    expect(body).toContain("--color-bg: #0a0a0a");
  });

  test("contains spec semantic class names", async () => {
    const req = new Request("http://localhost:3000/static/styles.css", {
      method: "GET",
    });
    const response = await staticStylesHandler(req);
    const body = await response.text();
    expect(body).toContain(".stat-card");
    expect(body).toContain(".sessions-table");
    expect(body).toContain(".daily-list");
    expect(body).toContain(".session-header");
    expect(body).toContain(".messages-list");
  });

  test(".sessions-list-page has same layout padding as .dashboard", async () => {
    const req = new Request("http://localhost:3000/static/styles.css", {
      method: "GET",
    });
    const response = await staticStylesHandler(req);
    const body = await response.text();
    // Both classes must appear together in the same layout rule
    const layoutRuleMatch = body.match(
      /\.dashboard[\s\S]*?max-width:\s*1200px/,
    );
    expect(layoutRuleMatch).not.toBeNull();
    expect(body).toContain(".sessions-list-page");
    // sessions-list-page must be in the same selector block as .dashboard
    const combinedSelectorMatch = body.match(
      /\.dashboard[^{]*\.sessions-list-page[^{]*{|\.sessions-list-page[^{]*\.dashboard[^{]*{/,
    );
    expect(combinedSelectorMatch).not.toBeNull();
  });
});
