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
});
