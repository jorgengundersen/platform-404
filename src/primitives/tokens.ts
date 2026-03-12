import type { TokenRecord } from "./schemas/token-record";

export type TokenTotals = TokenRecord;

const zero = (): TokenTotals => ({
  input: 0,
  output: 0,
  reasoning: 0,
  cacheRead: 0,
  cacheWrite: 0,
});

export function sumTokens(records: readonly TokenRecord[]): TokenTotals {
  return records.reduce(
    (acc, r) => ({
      input: acc.input + r.input,
      output: acc.output + r.output,
      reasoning: acc.reasoning + r.reasoning,
      cacheRead: acc.cacheRead + r.cacheRead,
      cacheWrite: acc.cacheWrite + r.cacheWrite,
    }),
    zero(),
  );
}

export function avgTokensPerMessage(
  total: TokenTotals,
  count: number,
): TokenTotals {
  if (count === 0) return zero();
  return {
    input: total.input / count,
    output: total.output / count,
    reasoning: total.reasoning / count,
    cacheRead: total.cacheRead / count,
    cacheWrite: total.cacheWrite / count,
  };
}

/** Sum an array of cost values (dollar amounts). */
export function sumCost(costs: readonly number[]): number {
  return costs.reduce((acc, c) => acc + c, 0);
}
