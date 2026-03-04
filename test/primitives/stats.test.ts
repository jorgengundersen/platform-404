import { describe, expect, it } from "bun:test";
import { avg, percentile, sum } from "../../src/primitives/stats";

describe("sum", () => {
  it("sums normal array", () => expect(sum([1, 2, 3])).toBe(6));
  it("returns 0 for empty", () => expect(sum([])).toBe(0));
  it("single element", () => expect(sum([42])).toBe(42));
  it("large numbers", () =>
    expect(sum([1_000_000, 2_000_000])).toBe(3_000_000));
});

describe("avg", () => {
  it("averages normal array", () => expect(avg([1, 2, 3])).toBe(2));
  it("returns 0 for empty", () => expect(avg([])).toBe(0));
  it("single element", () => expect(avg([7])).toBe(7));
});

describe("percentile", () => {
  it("p50 of sorted array", () =>
    expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3));
  it("p0 returns min", () => expect(percentile([10, 20, 30], 0)).toBe(10));
  it("p100 returns max", () => expect(percentile([10, 20, 30], 100)).toBe(30));
  it("single element any p", () => expect(percentile([5], 99)).toBe(5));
});
