import { Schema } from "@effect/schema";
import { TokenRecord } from "@/primitives/schemas/token-record";

export const AssistantMessageData = Schema.Struct({
  role: Schema.Literal("assistant"),
  modelID: Schema.String,
  providerID: Schema.String,
  cost: Schema.Number,
  tokens: TokenRecord,
  finish: Schema.optional(Schema.String),
});

export type AssistantMessageData = typeof AssistantMessageData.Type;

export const UserMessageData = Schema.Struct({
  role: Schema.Literal("user"),
  agent: Schema.String,
  model: Schema.Struct({
    providerID: Schema.String,
    modelID: Schema.String,
  }),
  system: Schema.optional(Schema.String),
  tools: Schema.optional(Schema.Array(Schema.String)),
});

export type UserMessageData = typeof UserMessageData.Type;

export const MessageData = Schema.Union(AssistantMessageData, UserMessageData);

export type MessageData = typeof MessageData.Type;
