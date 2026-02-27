import { describe, expect, test } from "bun:test";

import { rootHandler } from "@/ui/routes";

describe("GET /", () => {
  test("returns 200 HTML containing 'platform-404'", async () => {
    const req = new Request("http://localhost:3000/", {
      method: "GET",
    });
    const response = await rootHandler(req);

    expect(response.status).toBe(200);

    const body = await response.text();
    expect(body).toContain("platform-404");
  });
});
