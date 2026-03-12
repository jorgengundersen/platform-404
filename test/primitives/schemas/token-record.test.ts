import { describe, expect, it } from "bun:test";
import { Schema } from "@effect/schema";
import { TokenRecord } from "@/primitives/schemas/token-record";

describe("TokenRecord", () => {
  it("decodes a valid token record", () => {
    const raw = {
      input: 10,
      output: 20,
      reasoning: 5,
      cacheRead: 1,
      cacheWrite: 2,
    };
    const result = Schema.decodeUnknownSync(TokenRecord)(raw);
    expect(result).toEqual(raw);
  });

  it("fails on missing field", () => {
    const raw = { input: 10, output: 20, reasoning: 5, cacheRead: 1 };
    expect(() => Schema.decodeUnknownSync(TokenRecord)(raw)).toThrow();
  });
});
