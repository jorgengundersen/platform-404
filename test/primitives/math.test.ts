import { describe, expect, test } from "bun:test";

import { add } from "@/primitives/math";

describe("add", () => {
  test("adds two numbers", () => {
    const result = add(1, 2);

    expect(result).toBe(3);
  });
});
