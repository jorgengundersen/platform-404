import { Schema } from "@effect/schema";

export const TokenRecord = Schema.Struct({
  input: Schema.Number,
  output: Schema.Number,
  reasoning: Schema.Number,
  cacheRead: Schema.Number,
  cacheWrite: Schema.Number,
});

export type TokenRecord = typeof TokenRecord.Type;
