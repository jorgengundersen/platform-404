import { Schema } from "@effect/schema";
import { TokenRecord } from "@/primitives/schemas/token-record";

const TextPart = Schema.Struct({
  type: Schema.Literal("text"),
  text: Schema.String,
});

const ToolPart = Schema.Struct({
  type: Schema.Literal("tool"),
  tool: Schema.String,
  state: Schema.String,
  callID: Schema.String,
});

const StepFinishPart = Schema.Struct({
  type: Schema.Literal("step-finish"),
  cost: Schema.Number,
  tokens: TokenRecord,
});

export const PartData = Schema.Union(TextPart, ToolPart, StepFinishPart);

export type PartData = typeof PartData.Type;
