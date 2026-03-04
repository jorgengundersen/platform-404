export function sum(values: readonly number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}

export function avg(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return sum(values) / values.length;
}

export function percentile(values: readonly number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const vlo = sorted[lo] ?? 0;
  const vhi = sorted[hi] ?? 0;
  return vlo + (vhi - vlo) * (idx - lo);
}
