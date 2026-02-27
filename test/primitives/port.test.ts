import { describe, expect, test } from "bun:test";

import { getPort } from "@/primitives/port";

describe("getPort", () => {
  test("handles default, valid override, and invalid input", () => {
    const originalPort = process.env.PORT;

    try {
      delete process.env.PORT;
      expect(getPort()).toBe(3000);

      process.env.PORT = "8080";
      expect(getPort()).toBe(8080);

      process.env.PORT = "not-a-number";
      expect(() => getPort()).toThrow();

      process.env.PORT = "-1";
      expect(() => getPort()).toThrow();
    } finally {
      if (originalPort !== undefined) {
        process.env.PORT = originalPort;
      } else {
        delete process.env.PORT;
      }
    }
  });
});
