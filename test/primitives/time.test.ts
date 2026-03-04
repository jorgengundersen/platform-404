import { describe, expect, it } from "bun:test";
import {
  bucketByDay,
  dateRangeDays,
  formatDate,
} from "../../src/primitives/time";

describe("formatDate", () => {
  it("formats a known timestamp as YYYY-MM-DD", () => {
    // 2024-01-15T00:00:00.000Z = 1705276800000
    expect(formatDate(1705276800000)).toBe("2024-01-15");
  });

  it("formats epoch zero", () => {
    expect(formatDate(0)).toBe("1970-01-01");
  });

  it("formats a future date", () => {
    // 2030-06-20T00:00:00.000Z = 1908144000000
    expect(formatDate(1908144000000)).toBe("2030-06-20");
  });
});

describe("bucketByDay", () => {
  it("returns same YYYY-MM-DD as formatDate", () => {
    expect(bucketByDay(1705276800000)).toBe("2024-01-15");
  });

  it("mid-day timestamp stays in same day bucket", () => {
    // 2024-01-15T12:00:00.000Z = 1705320000000
    expect(bucketByDay(1705320000000)).toBe("2024-01-15");
  });

  it("end-of-day timestamp stays in same day bucket", () => {
    // 2024-01-15T23:59:59.999Z = 1705363199999
    expect(bucketByDay(1705363199999)).toBe("2024-01-15");
  });
});

describe("dateRangeDays", () => {
  it("returns single-element array for same day", () => {
    expect(dateRangeDays("2024-01-15", "2024-01-15")).toEqual(["2024-01-15"]);
  });

  it("returns correct multi-day range", () => {
    expect(dateRangeDays("2024-01-15", "2024-01-17")).toEqual([
      "2024-01-15",
      "2024-01-16",
      "2024-01-17",
    ]);
  });

  it("returns empty array when start is after end", () => {
    expect(dateRangeDays("2024-01-17", "2024-01-15")).toEqual([]);
  });

  it("handles month boundary", () => {
    expect(dateRangeDays("2024-01-31", "2024-02-02")).toEqual([
      "2024-01-31",
      "2024-02-01",
      "2024-02-02",
    ]);
  });
});
