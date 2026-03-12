import { Schema } from "@effect/schema";

export const SessionSummary = Schema.Struct({
  id: Schema.String,
  source: Schema.String,
  projectId: Schema.String,
  projectName: Schema.String,
  title: Schema.String,
  messageCount: Schema.Number,
  totalCost: Schema.Number,
  totalTokensInput: Schema.Number,
  totalTokensOutput: Schema.Number,
  totalTokensReasoning: Schema.Number,
  totalCacheRead: Schema.Number,
  totalCacheWrite: Schema.Number,
  timeCreated: Schema.Number,
  timeUpdated: Schema.Number,
});

export type SessionSummary = typeof SessionSummary.Type;

export const DateRange = Schema.Struct({
  start: Schema.String,
  end: Schema.String,
});

export type DateRange = typeof DateRange.Type;
