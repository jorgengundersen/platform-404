import { describe, expect, it } from "bun:test";
import { formatProjectName } from "../../src/primitives/project";

describe("formatProjectName", () => {
  it("truncates a 40-char hex git SHA to first 8 chars", () => {
    expect(formatProjectName("07c33b5c4dd6cd7d65dc7410e1692478dec5e335")).toBe(
      "07c33b5c",
    );
  });
});
