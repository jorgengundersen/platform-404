import { Either } from "effect";

import { formatEnvVarError, requiredNonEmptyString } from "@/primitives/config";

export type SourceConfig =
  | {
      readonly type: "opencode";
      readonly dbPath: string;
    }
  | {
      readonly type: "claude_code";
    };

export type Config = {
  readonly sources: ReadonlyArray<SourceConfig>;
  readonly dashboardDbPath: string;
  readonly syncIntervalMs: number;
};

/**
 * getConfig - single source of truth for runtime config.
 *
 * Fail fast: throws if required config is missing/invalid.
 */
export function getConfig(
  env: Record<string, string | undefined> = process.env,
): Config {
  const sources: SourceConfig[] = [];

  if (env.OPENCODE_DB_PATH !== undefined) {
    const opencodeDbPath = requiredNonEmptyString(env, "OPENCODE_DB_PATH");
    if (Either.isLeft(opencodeDbPath)) {
      throw new Error(formatEnvVarError(opencodeDbPath.left));
    }
    sources.push({ type: "opencode", dbPath: opencodeDbPath.right });
  }

  if (env.CLAUDE_CODE_OTEL === "1") {
    sources.push({ type: "claude_code" });
  }

  const dashboardDbPath = requiredNonEmptyString(env, "DASHBOARD_DB_PATH");
  if (Either.isLeft(dashboardDbPath)) {
    throw new Error(formatEnvVarError(dashboardDbPath.left));
  }

  let syncIntervalMs = 30000;
  const rawInterval = env.SYNC_INTERVAL_MS;
  if (rawInterval !== undefined) {
    const parsed = Number(rawInterval);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new Error(
        `Invalid env var: SYNC_INTERVAL_MS must be a positive integer, got: ${rawInterval}`,
      );
    }
    syncIntervalMs = parsed;
  }

  return {
    sources,
    dashboardDbPath: dashboardDbPath.right,
    syncIntervalMs,
  };
}
