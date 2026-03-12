import { describe, expect, it } from "bun:test";
import { Schema } from "@effect/schema";
import {
  AssistantMessageData,
  MessageData,
  UserMessageData,
} from "@/adapters/opencode/schemas/message-data";

describe("AssistantMessageData", () => {
  it("decodes a full assistant message", () => {
    const raw = {
      role: "assistant",
      modelID: "claude-3-5-sonnet",
      providerID: "anthropic",
      cost: 0.001,
      tokens: {
        input: 100,
        output: 50,
        reasoning: 0,
        cacheRead: 0,
        cacheWrite: 0,
      },
      finish: "end_turn",
    };
    const result = Schema.decodeUnknownSync(AssistantMessageData)(raw);
    expect(result.role).toBe("assistant");
    expect(result.cost).toBe(0.001);
  });

  it("decodes without optional finish field", () => {
    const raw = {
      role: "assistant",
      modelID: "gpt-4o",
      providerID: "openai",
      cost: 0.002,
      tokens: {
        input: 200,
        output: 100,
        reasoning: 10,
        cacheRead: 5,
        cacheWrite: 5,
      },
    };
    const result = Schema.decodeUnknownSync(AssistantMessageData)(raw);
    expect(result.finish).toBeUndefined();
  });

  it("fails when cost is missing", () => {
    const raw = {
      role: "assistant",
      modelID: "gpt-4o",
      providerID: "openai",
      tokens: {
        input: 200,
        output: 100,
        reasoning: 0,
        cacheRead: 0,
        cacheWrite: 0,
      },
    };
    expect(() => Schema.decodeUnknownSync(AssistantMessageData)(raw)).toThrow();
  });
});

describe("UserMessageData", () => {
  it("decodes a full user message", () => {
    const raw = {
      role: "user",
      agent: "coder",
      model: { providerID: "anthropic", modelID: "claude-3-5-sonnet" },
      system: "You are a helpful assistant",
      tools: ["bash", "read"],
    };
    const result = Schema.decodeUnknownSync(UserMessageData)(raw);
    expect(result.role).toBe("user");
    expect(result.agent).toBe("coder");
  });

  it("decodes without optional system and tools", () => {
    const raw = {
      role: "user",
      agent: "coder",
      model: { providerID: "anthropic", modelID: "claude-3-5-sonnet" },
    };
    const result = Schema.decodeUnknownSync(UserMessageData)(raw);
    expect(result.system).toBeUndefined();
    expect(result.tools).toBeUndefined();
  });

  it("fails when agent is missing", () => {
    const raw = {
      role: "user",
      model: { providerID: "anthropic", modelID: "claude-3-5-sonnet" },
    };
    expect(() => Schema.decodeUnknownSync(UserMessageData)(raw)).toThrow();
  });
});

describe("MessageData union", () => {
  it("decodes assistant via union", () => {
    const raw = {
      role: "assistant",
      modelID: "gpt-4o",
      providerID: "openai",
      cost: 0.01,
      tokens: {
        input: 10,
        output: 5,
        reasoning: 0,
        cacheRead: 0,
        cacheWrite: 0,
      },
    };
    const result = Schema.decodeUnknownSync(MessageData)(raw);
    expect(result.role).toBe("assistant");
  });

  it("decodes user via union", () => {
    const raw = {
      role: "user",
      agent: "coder",
      model: { providerID: "anthropic", modelID: "claude-3-5-sonnet" },
    };
    const result = Schema.decodeUnknownSync(MessageData)(raw);
    expect(result.role).toBe("user");
  });

  it("fails on unknown role", () => {
    const raw = { role: "system", content: "hello" };
    expect(() => Schema.decodeUnknownSync(MessageData)(raw)).toThrow();
  });
});
