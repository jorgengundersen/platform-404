import type { TokenRecord } from "./schemas/token-record";

export type TokenTotals = TokenRecord;

const zero = (): TokenTotals => ({
  input: 0,
  output: 0,
  reasoning: 0,
  cache: { read: 0, write: 0 },
});

export function sumTokens(records: readonly TokenRecord[]): TokenTotals {
  return records.reduce(
    (acc, r) => ({
      input: acc.input + r.input,
      output: acc.output + r.output,
      reasoning: acc.reasoning + r.reasoning,
      cache: {
        read: acc.cache.read + r.cache.read,
        write: acc.cache.write + r.cache.write,
      },
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
    cache: { read: total.cache.read / count, write: total.cache.write / count },
  };
}
