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

  test(".sessions-table has margin-top for spacing below overview-cards", async () => {
    const req = new Request("http://localhost:3000/static/styles.css", {
      method: "GET",
    });
    const response = await staticStylesHandler(req);
    const body = await response.text();
    // .sessions-table must declare margin-top so it gets breathing room after .overview-cards
    const marginTopMatch = body.match(/\.sessions-table[^}]*margin-top\s*:/);
    expect(marginTopMatch).not.toBeNull();
  });

  test(".projects-page and .models-page have same layout as .dashboard", async () => {
    const req = new Request("http://localhost:3000/static/styles.css", {
      method: "GET",
    });
    const response = await staticStylesHandler(req);
    const body = await response.text();
    // Both classes must appear in the same selector block as .dashboard
    expect(body).toContain(".projects-page");
    expect(body).toContain(".models-page");
    const projectsMatch = body.match(
      /\.dashboard[^{]*\.projects-page[^{]*{|\.projects-page[^{]*\.dashboard[^{]*{/,
    );
    expect(projectsMatch).not.toBeNull();
    const modelsMatch = body.match(
      /\.dashboard[^{]*\.models-page[^{]*{|\.models-page[^{]*\.dashboard[^{]*{/,
    );
    expect(modelsMatch).not.toBeNull();
  });

  test(".stat-card has min-height and .overview-cards uses align-items start", async () => {
    const req = new Request("http://localhost:3000/static/styles.css", {
      method: "GET",
    });
    const response = await staticStylesHandler(req);
    const body = await response.text();
    // stat-card must declare min-height so short-value cards look intentional
    const statCardMinHeight = body.match(/\.stat-card[^}]*min-height\s*:/);
    expect(statCardMinHeight).not.toBeNull();
    // overview-cards must use align-items: start so tall cards don't stretch siblings
    const overviewAlignItems = body.match(
      /\.overview-cards[^}]*align-items\s*:\s*start/,
    );
    expect(overviewAlignItems).not.toBeNull();
  });

  test("mobile stacks overview cards to one column to avoid KPI clipping", async () => {
    const req = new Request("http://localhost:3000/static/styles.css", {
      method: "GET",
    });
    const response = await staticStylesHandler(req);
    const body = await response.text();

    const mobileOverviewCardsSingleColumn = body.match(
      /@media \(max-width:\s*640px\)[\s\S]*?\.overview-cards\s*\{[^}]*grid-template-columns:\s*1fr\s*;/,
    );
    expect(mobileOverviewCardsSingleColumn).not.toBeNull();
  });
});
