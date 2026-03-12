import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import type { NormalizedBatch } from "@/primitives/schemas/normalized-batch";
import {
  type SourceAdapter,
  SourceAdapterError,
} from "@/services/source-adapter";

describe("SourceAdapter", () => {
  test("defines adapter contract and tagged error", async () => {
    const adapter: SourceAdapter = {
      source: "opencode",
      fetchBatch: Effect.succeed<NormalizedBatch | null>(null),
    };

    const batch = await Effect.runPromise(adapter.fetchBatch);
    const error = new SourceAdapterError({ reason: "boom" });

    expect(batch).toBeNull();
    expect(error._tag).toBe("SourceAdapterError");
    expect(error.reason).toBe("boom");
  });
});
