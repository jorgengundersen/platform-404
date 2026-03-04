import { describe, expect, it } from "bun:test";
import type { TokenRecord } from "../../src/primitives/schemas/token-record";
import {
  avgTokensPerMessage,
  sumCost,
  sumTokens,
} from "../../src/primitives/tokens";

const r = (
  i: number,
  o: number,
  reasoning: number,
  cr: number,
  cw: number,
): TokenRecord => ({
  input: i,
  output: o,
  reasoning,
  cache: { read: cr, write: cw },
});

describe("sumTokens", () => {
  it("sums multiple records", () => {
    const result = sumTokens([r(1, 2, 3, 4, 5), r(10, 20, 30, 40, 50)]);
    expect(result).toEqual({
      input: 11,
      output: 22,
      reasoning: 33,
      cache: { read: 44, write: 55 },
    });
  });

  it("single record is identity", () => {
    const rec = r(7, 8, 9, 1, 2);
    expect(sumTokens([rec])).toEqual(rec);
  });

  it("empty array returns zeros", () => {
    expect(sumTokens([])).toEqual({
      input: 0,
      output: 0,
      reasoning: 0,
      cache: { read: 0, write: 0 },
    });
  });

  it("handles zero values", () => {
    expect(sumTokens([r(0, 0, 0, 0, 0), r(0, 0, 0, 0, 0)])).toEqual({
      input: 0,
      output: 0,
      reasoning: 0,
      cache: { read: 0, write: 0 },
    });
  });
});

describe("avgTokensPerMessage", () => {
  it("divides each field by count", () => {
    const total = {
      input: 10,
      output: 20,
      reasoning: 30,
      cache: { read: 40, write: 50 },
    };
    expect(avgTokensPerMessage(total, 5)).toEqual({
      input: 2,
      output: 4,
      reasoning: 6,
      cache: { read: 8, write: 10 },
    });
  });

  it("division by zero returns zeros", () => {
    const total = {
      input: 10,
      output: 20,
      reasoning: 5,
      cache: { read: 3, write: 7 },
    };
    expect(avgTokensPerMessage(total, 0)).toEqual({
      input: 0,
      output: 0,
      reasoning: 0,
      cache: { read: 0, write: 0 },
    });
  });
});

describe("sumCost", () => {
  it("sums costs from multiple values", () => {
    expect(sumCost([0.01, 0.02, 0.003])).toBeCloseTo(0.033);
  });

  it("returns 0 for empty array", () => {
    expect(sumCost([])).toBe(0);
  });

  it("single value is identity", () => {
    expect(sumCost([0.05])).toBeCloseTo(0.05);
  });
});
