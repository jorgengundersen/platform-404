import { describe, expect, it } from "bun:test";
import { Schema } from "@effect/schema";
import { NormalizedBatch } from "@/primitives/schemas/normalized-batch";

describe("NormalizedBatch", () => {
  it("decodes a normalized adapter batch", () => {
    const raw = {
      source: "opencode",
      sessions: [
        {
          id: "ses_1",
          source: "opencode",
          projectId: "proj_1",
          projectName: "platform-404",
          title: "Fix dashboard",
          messageCount: 2,
          totalCost: 0.12,
          totalTokensInput: 100,
          totalTokensOutput: 50,
          totalTokensReasoning: 10,
          totalCacheRead: 3,
          totalCacheWrite: 4,
          timeCreated: 1700000000000,
          timeUpdated: 1700000100000,
          metadata: {
            version: "1.0.0",
          },
        },
      ],
      messages: [
        {
          id: "msg_1",
          sessionId: "ses_1",
          source: "opencode",
          role: "assistant",
          providerId: "anthropic",
          modelId: "claude-sonnet-4-6",
          cost: 0.12,
          tokensInput: 100,
          tokensOutput: 50,
          tokensReasoning: 10,
          cacheRead: 3,
          cacheWrite: 4,
          timeCreated: 1700000005000,
          metadata: {
            finish: "stop",
          },
        },
      ],
      cursorKey: "opencode:session",
      cursorValue: 1700000100000,
    };

    const decoded = Schema.decodeUnknownSync(NormalizedBatch)(raw);
    expect(decoded.sessions[0]?.id).toBe("ses_1");
    expect(decoded.messages[0]?.modelId).toBe("claude-sonnet-4-6");
    expect(decoded.cursorValue).toBe(1700000100000);
  });
});
