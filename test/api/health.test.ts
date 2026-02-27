import { describe, expect, test } from "bun:test";

import { healthHandler } from "@/api/health";

describe("GET /api/health", () => {
  test("returns 200 with JSON { data: { status: 'ok' } }", async () => {
    const req = new Request("http://localhost:3000/api/health", {
      method: "GET",
    });
    const response = await healthHandler(req);

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({
      data: {
        status: "ok",
      },
    });
  });
});
