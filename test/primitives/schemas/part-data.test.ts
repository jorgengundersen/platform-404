import { describe, expect, it } from "bun:test";
import { Schema } from "@effect/schema";
import { PartData } from "@/primitives/schemas/part-data";

describe("PartData", () => {
  it("decodes text part", () => {
    const raw = { type: "text", text: "hello world" };
    const result = Schema.decodeUnknownSync(PartData)(raw);
    expect(result.type).toBe("text");
  });

  it("decodes tool part", () => {
    const raw = {
      type: "tool",
      tool: "bash",
      state: "completed",
      callID: "call-1",
    };
    const result = Schema.decodeUnknownSync(PartData)(raw);
    expect(result.type).toBe("tool");
  });

  it("decodes step-finish part", () => {
    const raw = {
      type: "step-finish",
      cost: 0.001,
      tokens: {
        input: 10,
        output: 5,
        reasoning: 0,
        cacheRead: 0,
        cacheWrite: 0,
      },
    };
    const result = Schema.decodeUnknownSync(PartData)(raw);
    expect(result.type).toBe("step-finish");
  });

  it("fails on unknown type", () => {
    const raw = { type: "unknown" };
    expect(() => Schema.decodeUnknownSync(PartData)(raw)).toThrow();
  });
});
