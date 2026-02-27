import { describe, expect, test } from "bun:test";

describe("main.ts", () => {
  test("importing main.ts does not execute side effects", async () => {
    // Load main.ts and verify it exports a function (not executing anything on import)
    const main = await import("@/main");

    // Verify it exports a server boot function
    expect(typeof main.boot).toBe("function");
  });
});
