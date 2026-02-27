import { describe, expect, test } from "bun:test";

import { getConfig } from "@/config";

describe("getConfig", () => {
  test("throws when OPENCODE_DB_PATH missing", () => {
    expect(() =>
      getConfig({
        ...process.env,
        OPENCODE_DB_PATH: undefined,
      }),
    ).toThrow("Missing required env var: OPENCODE_DB_PATH");
  });
});
