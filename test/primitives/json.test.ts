import { describe, expect, test } from "bun:test";
import { Option } from "effect";

import { safeParseJson } from "@/primitives/json";

describe("safeParseJson", () => {
  test("returns Some for valid JSON object", () => {
    const result = safeParseJson('{"a":1}');
    expect(Option.isSome(result)).toBe(true);
    expect((result as Option.Some<unknown>).value).toEqual({ a: 1 });
  });

  test("returns None for invalid JSON", () => {
    const result = safeParseJson("not json");
    expect(Option.isNone(result)).toBe(true);
  });

  test("returns None for empty string", () => {
    const result = safeParseJson("");
    expect(Option.isNone(result)).toBe(true);
  });

  test("returns Some for nested objects", () => {
    const result = safeParseJson('{"a":{"b":{"c":3}}}');
    expect(Option.isSome(result)).toBe(true);
    expect((result as Option.Some<unknown>).value).toEqual({
      a: { b: { c: 3 } },
    });
  });

  test("returns Some for arrays", () => {
    const result = safeParseJson("[1,2,3]");
    expect(Option.isSome(result)).toBe(true);
    expect((result as Option.Some<unknown>).value).toEqual([1, 2, 3]);
  });

  test("returns Some for null literal", () => {
    const result = safeParseJson("null");
    expect(Option.isSome(result)).toBe(true);
    expect((result as Option.Some<unknown>).value).toBeNull();
  });
});
