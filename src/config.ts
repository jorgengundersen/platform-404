import { Either } from "effect";

import { formatEnvVarError, requiredNonEmptyString } from "@/primitives/config";

export type Config = {
  readonly opencodeDbPath: string;
};

/**
 * getConfig - single source of truth for runtime config.
 *
 * Fail fast: throws if required config is missing/invalid.
 */
export function getConfig(
  env: Record<string, string | undefined> = process.env,
): Config {
  const opencodeDbPath = requiredNonEmptyString(env, "OPENCODE_DB_PATH");
  if (Either.isLeft(opencodeDbPath)) {
    throw new Error(formatEnvVarError(opencodeDbPath.left));
  }

  return {
    opencodeDbPath: opencodeDbPath.right,
  };
}
