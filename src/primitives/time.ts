/**
 * Pure time utilities. No side effects.
 */

/** Returns YYYY-MM-DD for a UTC millisecond timestamp. */
export function formatDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Returns the YYYY-MM-DD day bucket for a UTC millisecond timestamp. */
export function bucketByDay(ms: number): string {
  return formatDate(ms);
}

/**
 * Returns an array of YYYY-MM-DD strings from start to end (inclusive).
 * Returns [] if start > end.
 */
export function dateRangeDays(start: string, end: string): string[] {
  const result: string[] = [];
  let current = new Date(`${start}T00:00:00.000Z`);
  const last = new Date(`${end}T00:00:00.000Z`);
  while (current <= last) {
    result.push(current.toISOString().slice(0, 10));
    current = new Date(current.getTime() + 86_400_000);
  }
  return result;
}
