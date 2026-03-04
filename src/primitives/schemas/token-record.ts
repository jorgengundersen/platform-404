import { Schema } from "@effect/schema";

export const TokenRecord = Schema.Struct({
  input: Schema.Number,
  output: Schema.Number,
  reasoning: Schema.Number,
  cache: Schema.Struct({
    read: Schema.Number,
    write: Schema.Number,
  }),
});

export type TokenRecord = typeof TokenRecord.Type;
