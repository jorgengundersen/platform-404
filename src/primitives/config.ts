import { Either } from "effect";

export type EnvVarError = MissingEnvVarError | InvalidEnvVarError;

export type MissingEnvVarError = {
  readonly _tag: "MissingEnvVarError";
  readonly key: string;
};

export type InvalidEnvVarError = {
  readonly _tag: "InvalidEnvVarError";
  readonly key: string;
  readonly reason: "empty";
};

export function requiredNonEmptyString(
  env: Record<string, string | undefined>,
  key: string,
): Either.Either<string, EnvVarError> {
  const raw = env[key];

  if (raw === undefined) {
    return Either.left({
      _tag: "MissingEnvVarError",
      key,
    });
  }

  const value = raw.trim();
  if (value.length === 0) {
    return Either.left({
      _tag: "InvalidEnvVarError",
      key,
      reason: "empty",
    });
  }

  return Either.right(value);
}

export function formatEnvVarError(err: EnvVarError): string {
  switch (err._tag) {
    case "MissingEnvVarError":
      return `Missing required env var: ${err.key}`;
    case "InvalidEnvVarError":
      return `Invalid env var: ${err.key} must be a non-empty string`;
  }
}
