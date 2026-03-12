import { Data, type Effect } from "effect";
import type { NormalizedBatch } from "@/primitives/schemas/normalized-batch";

export class SourceAdapterError extends Data.TaggedError("SourceAdapterError")<{
  readonly reason: string;
  readonly cause?: unknown;
}> {}

export type SourceAdapter = {
  readonly source: string;
  readonly fetchBatch: Effect.Effect<
    NormalizedBatch | null,
    SourceAdapterError
  >;
};
