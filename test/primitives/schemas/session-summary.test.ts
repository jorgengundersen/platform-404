import { describe, expect, it } from "bun:test";
import { Schema } from "@effect/schema";
import {
  DateRange,
  SessionSummary,
} from "@/primitives/schemas/session-summary";

describe("SessionSummary", () => {
  it("decodes a full session summary", () => {
    const raw = {
      id: "ses_abc",
      projectId: "proj_1",
      projectName: "my-project",
      title: "Fix bug",
      messageCount: 10,
      totalCost: 0.05,
      totalTokensInput: 1000,
      totalTokensOutput: 500,
      totalTokensReasoning: 20,
      totalCacheRead: 100,
      totalCacheWrite: 50,
      timeCreated: 1700000000000,
      timeUpdated: 1700001000000,
    };
    const result = Schema.decodeUnknownSync(SessionSummary)(raw);
    expect(result.id).toBe("ses_abc");
    expect(result.messageCount).toBe(10);
  });

  it("fails when required field is missing", () => {
    const raw = { id: "ses_abc" };
    expect(() => Schema.decodeUnknownSync(SessionSummary)(raw)).toThrow();
  });
});

describe("DateRange", () => {
  it("decodes a valid date range", () => {
    const raw = { start: "2024-01-01", end: "2024-01-31" };
    const result = Schema.decodeUnknownSync(DateRange)(raw);
    expect(result.start).toBe("2024-01-01");
    expect(result.end).toBe("2024-01-31");
  });

  it("fails when end is missing", () => {
    const raw = { start: "2024-01-01" };
    expect(() => Schema.decodeUnknownSync(DateRange)(raw)).toThrow();
  });
});
