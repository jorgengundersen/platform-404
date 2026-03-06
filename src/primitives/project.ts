/**
 * Pure project utilities. No side effects.
 */

const GIT_SHA_RE = /^[0-9a-f]{40}$/i;

/**
 * Returns a human-readable project name.
 * If the name is a 40-character git SHA hash, returns the first 8 characters.
 * If the name is null/undefined, returns the projectId (first 8 chars if it looks like a SHA).
 */
export function formatProjectName(
  projectName: string | null | undefined,
  projectId?: string,
): string {
  const raw = projectName ?? projectId ?? "";
  if (GIT_SHA_RE.test(raw)) {
    return raw.slice(0, 8);
  }
  return raw;
}
