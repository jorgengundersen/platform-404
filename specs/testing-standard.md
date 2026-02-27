# Testing Standard

## Philosophy

**Trophy testing model.** Invest most effort where it gives the most confidence per line of test code.

```
        /  E2E  \           Fewest - smoke tests only
       /----------\
      / Integration \       Some - service layer tests
     /----------------\
    /    Unit Tests     \   Most - primitives
   /--------------------\
  / Static Analysis (TS) \  Always on - compiler does the work
```

**Black box testing.** Test behavior, not implementation. Tests call public APIs with inputs and assert on outputs. No mocking internals, no testing private functions.

## Test Runner

`bun:test` - built into Bun, zero config, fast.

```json
// package.json
{
  "scripts": {
    "test": "bun test",
    "test:watch": "bun test --watch"
  }
}
```

## Unit Tests (Primitives)

The bulk of tests live here. Every primitive function gets unit tests.

### Location

Mirror the source structure under `test/`:

```
src/primitives/tokens.ts     -->  test/primitives/tokens.test.ts
src/primitives/time.ts       -->  test/primitives/time.test.ts
src/primitives/json.ts       -->  test/primitives/json.test.ts
```

### Structure

```typescript
import { describe, test, expect } from "bun:test"
import { sumTokens } from "@/primitives/tokens"

describe("sumTokens", () => {
  test("sums token fields across multiple records", () => {
    const result = sumTokens([
      { input: 100, output: 50, reasoning: 10, cache: { read: 20, write: 5 } },
      { input: 200, output: 80, reasoning: 30, cache: { read: 40, write: 10 } },
    ])

    expect(result).toEqual({
      input: 300,
      output: 130,
      reasoning: 40,
      cache: { read: 60, write: 15 },
    })
  })

  test("returns zeros for empty array", () => {
    const result = sumTokens([])

    expect(result).toEqual({
      input: 0,
      output: 0,
      reasoning: 0,
      cache: { read: 0, write: 0 },
    })
  })
})
```

### Rules

- **One `describe` per function** being tested
- **Descriptive test names** that read as sentences: `"returns zeros for empty array"`
- **Prefer no mocks** - most primitives are referentially transparent and need no mocks. When a primitive wraps an external dependency, test doubles are acceptable but prefer the real dependency when it's fast and deterministic
- **Test edge cases**: empty inputs, zero values, large numbers, malformed data
- **Test the contract, not the code**: if the implementation changes but behavior stays the same, tests should still pass
- **No test helpers that hide assertions** - keep assertions visible in each test

> **Note:** Some primitives wrap external dependencies (e.g. `@effect/schema`, codecs).
> These are still tested at the unit level but may need the external dependency present rather than mocked.

### What to Test

| Primitive | Test Cases |
|-----------|-----------|
| `sumTokens` | multiple records, single record, empty array, zero values |
| `avgTokensPerMessage` | normal division, division by zero, single message |
| `formatDate` | various timestamps, epoch zero, future dates |
| `safeParseJson` | valid JSON, invalid JSON, empty string, nested objects |
| `bucketByDay` | same day, multiple days, empty input, timezone boundaries |
| Schema decode | valid data, missing fields, wrong types, extra fields |

### Schema Validation Tests

```typescript
import { describe, test, expect } from "bun:test"
import { Schema } from "@effect/schema"
import { TokenRecord } from "@/primitives/schemas/tokens"

describe("TokenRecord schema", () => {
  test("decodes valid token record", () => {
    const input = { input: 100, output: 50, reasoning: 10, cache: { read: 20, write: 5 } }
    const result = Schema.decodeUnknownSync(TokenRecord)(input)
    expect(result).toEqual(input)
  })

  test("rejects missing fields", () => {
    const input = { input: 100 }
    expect(() => Schema.decodeUnknownSync(TokenRecord)(input)).toThrow()
  })
})
```

## Integration Tests (Services)

Fewer tests, higher confidence. These test that services work correctly with real (test) databases.

### Location

```
test/services/ingestion.test.ts
test/services/stats.test.ts
```

### Strategy

- Use a real SQLite database (in-memory or temp file)
- Seed with known test data
- Test the service through its public Effect interface
- Run with `Effect.runPromise` in tests

```typescript
import { describe, test, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { StatsService, StatsServiceLive } from "@/services/stats"
import { DashboardDb, DashboardDbTest } from "@/services/dashboard-db"

// Test layer using in-memory SQLite
const TestLayer = StatsServiceLive.pipe(
  Layer.provide(DashboardDbTest),
)

describe("StatsService", () => {
  test("getOverview returns correct totals after ingestion", async () => {
    const program = Effect.gen(function* () {
      const stats = yield* StatsService
      // seed test data first...
      const overview = yield* stats.getOverview
      expect(overview.totalSessions).toBe(3)
      expect(overview.totalCost).toBeCloseTo(0.15)
    })

    await Effect.runPromise(program.pipe(Effect.provide(TestLayer)))
  })
})
```

### Rules

- Each test sets up its own data (no shared mutable state between tests)
- Use in-memory SQLite (`:memory:`) for speed
- Provide a `*Test` layer variant for each database service
- Test happy paths and key error scenarios
- No mocking of database - use real SQLite

### What to Test

| Service | Test Cases |
|---------|-----------|
| IngestionService | ingests new sessions, skips already-ingested, handles empty source, updates cursor |
| StatsService | correct totals, daily breakdown, date range filtering, empty database |
| DashboardDb | migrations run, schema is correct, queries return expected shapes |

## API Tests

Light integration tests for HTTP routes. Test request/response shape.

```typescript
import { describe, test, expect } from "bun:test"

describe("GET /api/health", () => {
  test("returns 200 with status", async () => {
    const res = await fetch("http://localhost:3000/api/health")
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.data).toHaveProperty("status", "ok")
    expect(body.data).toHaveProperty("lastSync")
  })
})
```

Use sparingly. Most logic is tested at the service and primitive layers.

## What We Don't Test

- **UI HTML output** - visual verification is more effective than string matching
- **CSS** - not testable in meaningful ways without a browser
- **Effect Layer wiring** - the type system catches composition errors
- **Third-party libraries directly** - trust `@effect/sql`, `bun:sqlite`, etc. to work correctly. DO test your primitives that wrap or configure these libraries (e.g. schema definitions, codec wrappers) — you're testing your code's contract with the library, not the library itself
- **Private functions** - if they matter, they should be primitives; if not, they're implementation details

## Test Quality Checklist

Before adding a test, ask:

1. **Does this test behavior or implementation?** Only test behavior.
2. **Would this test break if I refactored internals?** If yes, it's too coupled.
3. **Does this test add confidence?** If the type system already catches it, skip it.
4. **Is this the right layer to test this?** Push tests down to the lowest layer that makes sense.

## Running Tests

```bash
# Run all tests
bun test

# Run specific file
bun test test/primitives/tokens.test.ts

# Watch mode during development
bun test --watch

# Run with coverage
bun test --coverage
```

## CI

Tests run on every push. Build fails if any test fails.

```yaml
test:
  runs-on: ubuntu-latest
  steps:
    - uses: oven-sh/setup-bun@v2
    - run: bun install --frozen-lockfile
    - run: bun test
    - run: bun run typecheck
```
