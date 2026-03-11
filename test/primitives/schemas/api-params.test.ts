import { describe, expect, it } from "bun:test";
import { Schema } from "@effect/schema";
import {
  DateRangeParams,
  decodeDashboardRootQueryParams,
  SessionsListParams,
} from "@/primitives/schemas/api-params";

describe("DateRangeParams", () => {
  it("decodes valid YYYY-MM-DD dates", () => {
    const result = Schema.decodeUnknownSync(DateRangeParams)({
      start: "2026-01-01",
      end: "2026-01-31",
    });
    expect(result.start).toBe("2026-01-01");
    expect(result.end).toBe("2026-01-31");
  });

  it("rejects non-YYYY-MM-DD start date", () => {
    expect(() =>
      Schema.decodeUnknownSync(DateRangeParams)({
        start: "01/01/2026",
        end: "2026-01-31",
      }),
    ).toThrow();
  });

  it("rejects missing end param", () => {
    expect(() =>
      Schema.decodeUnknownSync(DateRangeParams)({ start: "2026-01-01" }),
    ).toThrow();
  });
});

describe("SessionsListParams", () => {
  it("decodes valid page and limit", () => {
    const result = Schema.decodeUnknownSync(SessionsListParams)({
      page: 2,
      limit: 10,
    });
    expect(result.page).toBe(2);
    expect(result.limit).toBe(10);
  });

  it("uses defaults when params absent", () => {
    const result = Schema.decodeUnknownSync(SessionsListParams)({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it("rejects page=0", () => {
    expect(() =>
      Schema.decodeUnknownSync(SessionsListParams)({ page: 0, limit: 10 }),
    ).toThrow();
  });

  it("rejects limit > 100", () => {
    expect(() =>
      Schema.decodeUnknownSync(SessionsListParams)({ page: 1, limit: 101 }),
    ).toThrow();
  });
});

describe("decodeDashboardRootQueryParams", () => {
  it("applies defaults for empty and invalid range/compare", () => {
    expect(decodeDashboardRootQueryParams({})).toEqual({
      range: "30d",
      compare: "1",
    });

    expect(
      decodeDashboardRootQueryParams({ range: "garbage", compare: "-1" }),
    ).toEqual({
      range: "30d",
      compare: "1",
    });

    expect(
      decodeDashboardRootQueryParams({ range: "7d", compare: "0" }),
    ).toEqual({
      range: "7d",
      compare: "0",
    });
  });
});
