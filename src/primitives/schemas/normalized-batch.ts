import { Schema } from "@effect/schema";

const Metadata = Schema.NullOr(
  Schema.Record({
    key: Schema.String,
    value: Schema.Unknown,
  }),
);

export const NormalizedSession = Schema.Struct({
  id: Schema.String,
  source: Schema.String,
  projectId: Schema.NullOr(Schema.String),
  projectName: Schema.NullOr(Schema.String),
  title: Schema.NullOr(Schema.String),
  messageCount: Schema.Number,
  totalCost: Schema.Number,
  totalTokensInput: Schema.Number,
  totalTokensOutput: Schema.Number,
  totalTokensReasoning: Schema.Number,
  totalCacheRead: Schema.Number,
  totalCacheWrite: Schema.Number,
  timeCreated: Schema.Number,
  timeUpdated: Schema.Number,
  metadata: Metadata,
});

export type NormalizedSession = typeof NormalizedSession.Type;

export const NormalizedMessage = Schema.Struct({
  id: Schema.String,
  sessionId: Schema.String,
  source: Schema.String,
  role: Schema.String,
  providerId: Schema.NullOr(Schema.String),
  modelId: Schema.NullOr(Schema.String),
  cost: Schema.NullOr(Schema.Number),
  tokensInput: Schema.Number,
  tokensOutput: Schema.Number,
  tokensReasoning: Schema.Number,
  cacheRead: Schema.Number,
  cacheWrite: Schema.Number,
  timeCreated: Schema.Number,
  metadata: Metadata,
});

export type NormalizedMessage = typeof NormalizedMessage.Type;

export const NormalizedBatch = Schema.Struct({
  source: Schema.String,
  sessions: Schema.Array(NormalizedSession),
  messages: Schema.Array(NormalizedMessage),
  cursorKey: Schema.String,
  cursorValue: Schema.Number,
});

export type NormalizedBatch = typeof NormalizedBatch.Type;
