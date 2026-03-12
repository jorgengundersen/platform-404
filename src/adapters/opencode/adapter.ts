import { Schema } from "@effect/schema";
import { Context, Data, Effect, Layer, Option } from "effect";
import { MessageData } from "@/adapters/opencode/schemas/message-data";
import { PartData } from "@/adapters/opencode/schemas/part-data";
import { SourceDb } from "@/adapters/opencode/source-db";
import { safeParseJson } from "@/primitives/json";
import type { NormalizedBatch } from "@/primitives/schemas/normalized-batch";
import { DashboardDb } from "@/services/dashboard-db";
import {
  type SourceAdapter,
  SourceAdapterError,
} from "@/services/source-adapter";

export class OpenCodeAdapterError extends Data.TaggedError(
  "OpenCodeAdapterError",
)<{
  readonly reason: string;
  readonly cause?: unknown;
}> {}

export class OpenCodeAdapter extends Context.Tag("OpenCodeAdapter")<
  OpenCodeAdapter,
  SourceAdapter
>() {}

const decodeMessage = Schema.decodeUnknownOption(MessageData);
const decodePart = Schema.decodeUnknownOption(PartData);

export const OpenCodeAdapterLive: Layer.Layer<
  OpenCodeAdapter,
  never,
  SourceDb | DashboardDb
> = Layer.effect(
  OpenCodeAdapter,
  Effect.gen(function* () {
    const sourceDb = yield* SourceDb;
    const { sqlite } = yield* DashboardDb;

    const fetchBatch = Effect.gen(function* () {
      const sessionCursorRow = sqlite
        .query(
          "SELECT last_time_updated FROM ingestion_cursor WHERE source = 'opencode:session'",
        )
        .get() as { last_time_updated: number } | null;

      const sessionSinceMs = sessionCursorRow?.last_time_updated ?? -1;

      const sessions = yield* sourceDb
        .listSessionsUpdatedSince(sessionSinceMs)
        .pipe(
          Effect.mapError(
            (cause) =>
              new SourceAdapterError({
                reason: "Failed to list sessions",
                cause,
              }),
          ),
        );

      if (sessions.length === 0) {
        return null;
      }

      const projectIds = Array.from(
        new Set(sessions.map((session) => session.project_id)),
      );
      const projects = yield* sourceDb.listProjectsByIds(projectIds).pipe(
        Effect.mapError(
          (cause) =>
            new SourceAdapterError({
              reason: "Failed to list projects",
              cause,
            }),
        ),
      );

      const projectNameMap = new Map(
        projects.map((project) => [project.id, project.name]),
      );

      const sessionIds = sessions.map((session) => session.id);
      const messages = yield* sourceDb.listMessagesForSessions(sessionIds).pipe(
        Effect.mapError(
          (cause) =>
            new SourceAdapterError({
              reason: "Failed to list messages",
              cause,
            }),
        ),
      );

      const messageIds = messages.map((message) => message.id);
      const parts = yield* sourceDb.listPartsForMessages(messageIds).pipe(
        Effect.mapError(
          (cause) =>
            new SourceAdapterError({
              reason: "Failed to list parts",
              cause,
            }),
        ),
      );

      const normalizedMessages: NormalizedBatch["messages"] = messages.map(
        (message) => {
          const parsed = safeParseJson(message.data);
          const raw = Option.getOrNull(parsed);
          const decoded =
            raw !== null ? Option.getOrNull(decodeMessage(raw)) : null;

          if (decoded?.role === "assistant") {
            return {
              id: message.id,
              sessionId: message.session_id,
              source: "opencode",
              role: "assistant",
              providerId: decoded.providerID,
              modelId: decoded.modelID,
              cost: decoded.cost,
              tokensInput: decoded.tokens.input,
              tokensOutput: decoded.tokens.output,
              tokensReasoning: decoded.tokens.reasoning,
              cacheRead: decoded.tokens.cacheRead,
              cacheWrite: decoded.tokens.cacheWrite,
              timeCreated: message.time_created,
              metadata: decoded.finish ? { finish: decoded.finish } : null,
            };
          }

          if (decoded?.role === "user") {
            return {
              id: message.id,
              sessionId: message.session_id,
              source: "opencode",
              role: "user",
              providerId: decoded.model.providerID,
              modelId: decoded.model.modelID,
              cost: null,
              tokensInput: 0,
              tokensOutput: 0,
              tokensReasoning: 0,
              cacheRead: 0,
              cacheWrite: 0,
              timeCreated: message.time_created,
              metadata: { agent: decoded.agent },
            };
          }

          const roleRaw =
            raw !== null &&
            typeof raw === "object" &&
            "role" in raw &&
            typeof (raw as Record<string, unknown>).role === "string"
              ? (raw as Record<string, unknown>).role
              : "unknown";

          return {
            id: message.id,
            sessionId: message.session_id,
            source: "opencode",
            role: String(roleRaw),
            providerId: null,
            modelId: null,
            cost: null,
            tokensInput: 0,
            tokensOutput: 0,
            tokensReasoning: 0,
            cacheRead: 0,
            cacheWrite: 0,
            timeCreated: message.time_created,
            metadata: null,
          };
        },
      );

      const sessionMsgMap = new Map<
        string,
        {
          totalCost: number;
          totalTokensInput: number;
          totalTokensOutput: number;
          totalTokensReasoning: number;
          totalCacheRead: number;
          totalCacheWrite: number;
          messageCount: number;
        }
      >();

      for (const message of normalizedMessages) {
        const existing = sessionMsgMap.get(message.sessionId) ?? {
          totalCost: 0,
          totalTokensInput: 0,
          totalTokensOutput: 0,
          totalTokensReasoning: 0,
          totalCacheRead: 0,
          totalCacheWrite: 0,
          messageCount: 0,
        };

        sessionMsgMap.set(message.sessionId, {
          totalCost: existing.totalCost + (message.cost ?? 0),
          totalTokensInput: existing.totalTokensInput + message.tokensInput,
          totalTokensOutput: existing.totalTokensOutput + message.tokensOutput,
          totalTokensReasoning:
            existing.totalTokensReasoning + message.tokensReasoning,
          totalCacheRead: existing.totalCacheRead + message.cacheRead,
          totalCacheWrite: existing.totalCacheWrite + message.cacheWrite,
          messageCount: existing.messageCount + 1,
        });
      }

      const msgSessionMap = new Map(
        messages.map((message) => [message.id, message.session_id]),
      );
      const sessionPartsMap = new Map<
        string,
        {
          totalCost: number;
          totalTokensInput: number;
          totalTokensOutput: number;
          totalTokensReasoning: number;
          totalCacheRead: number;
          totalCacheWrite: number;
        }
      >();

      for (const part of parts) {
        const parsed = safeParseJson(part.data);
        const raw = Option.getOrNull(parsed);
        const decoded = raw !== null ? Option.getOrNull(decodePart(raw)) : null;

        if (decoded?.type !== "step-finish") {
          continue;
        }

        const sessionId = msgSessionMap.get(part.message_id) ?? part.session_id;
        const existing = sessionPartsMap.get(sessionId) ?? {
          totalCost: 0,
          totalTokensInput: 0,
          totalTokensOutput: 0,
          totalTokensReasoning: 0,
          totalCacheRead: 0,
          totalCacheWrite: 0,
        };

        sessionPartsMap.set(sessionId, {
          totalCost: existing.totalCost + decoded.cost,
          totalTokensInput: existing.totalTokensInput + decoded.tokens.input,
          totalTokensOutput: existing.totalTokensOutput + decoded.tokens.output,
          totalTokensReasoning:
            existing.totalTokensReasoning + decoded.tokens.reasoning,
          totalCacheRead: existing.totalCacheRead + decoded.tokens.cacheRead,
          totalCacheWrite: existing.totalCacheWrite + decoded.tokens.cacheWrite,
        });
      }

      const normalizedSessions: NormalizedBatch["sessions"] = sessions.map(
        (session) => {
          const messageAgg = sessionMsgMap.get(session.id) ?? {
            totalCost: 0,
            totalTokensInput: 0,
            totalTokensOutput: 0,
            totalTokensReasoning: 0,
            totalCacheRead: 0,
            totalCacheWrite: 0,
            messageCount: 0,
          };
          const partAgg = sessionPartsMap.get(session.id);
          const totals =
            partAgg === undefined
              ? messageAgg
              : {
                  ...partAgg,
                  messageCount: messageAgg.messageCount,
                };

          return {
            id: session.id,
            source: "opencode",
            projectId: session.project_id,
            projectName: projectNameMap.get(session.project_id) ?? null,
            title: session.title,
            messageCount: totals.messageCount,
            totalCost: totals.totalCost,
            totalTokensInput: totals.totalTokensInput,
            totalTokensOutput: totals.totalTokensOutput,
            totalTokensReasoning: totals.totalTokensReasoning,
            totalCacheRead: totals.totalCacheRead,
            totalCacheWrite: totals.totalCacheWrite,
            timeCreated: session.time_created,
            timeUpdated: session.time_updated,
            metadata: null,
          };
        },
      );

      const maxSessionTime =
        sessions[sessions.length - 1]?.time_updated ?? sessionSinceMs;
      const maxMessageTime =
        messages.length > 0
          ? Math.max(...messages.map((message) => message.time_updated))
          : sessionSinceMs;

      return {
        source: "opencode",
        sessions: normalizedSessions,
        messages: normalizedMessages,
        cursorKey: "opencode:session",
        cursorValue: maxSessionTime,
        cursorUpdates: [
          { key: "opencode:session", value: maxSessionTime },
          { key: "opencode:message", value: maxMessageTime },
        ],
      } satisfies NormalizedBatch;
    });

    return {
      source: "opencode",
      fetchBatch,
    };
  }),
);
