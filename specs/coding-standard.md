# Coding Standard

## TypeScript

### Compiler Config

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "bundler",
    "module": "esnext",
    "target": "esnext",
    "lib": ["esnext"],
    "types": ["bun-types"],
    "paths": { "@/*": ["./src/*"] }
  }
}
```

### General Rules

- No `any`. Use `unknown` + narrowing or `@effect/schema` decode.
- No type assertions (`as`) except in test fixtures.
- Prefer `const` over `let`. Never `var`.
- No classes except for Effect `Context.Tag` declarations.
- No `null` - use `Option` from Effect or `undefined`.
- No exceptions - use Effect's error channel.
- No enums - use string literal unions or `@effect/schema` literals.
- Exhaustive switch via `never` check in default case.

### Naming

| Thing | Convention | Example |
|-------|-----------|---------|
| Files | kebab-case | `daily-stats.ts` |
| Functions | camelCase | `computeTokenTotals` |
| Types/Interfaces | PascalCase | `SessionSummary` |
| Constants | UPPER_SNAKE | `DEFAULT_SYNC_INTERVAL` |
| Effect Services | PascalCase (Tag name) | `DashboardDb` |
| Layers | PascalCase + `Live` suffix | `DashboardDbLive` |
| Test files | `*.test.ts` | `tokens.test.ts` |

### File Organization

Each file exports one primary concept. Related helpers are fine in the same file.

```typescript
// tokens.ts - primitive

/** Sum token fields from multiple messages. */
export function sumTokens(messages: readonly TokenRecord[]): TokenTotals {
  // ...
}

/** Compute average tokens per message. */
export function avgTokensPerMessage(total: TokenTotals, count: number): TokenTotals {
  // ...
}
```

Max file length: aim for under 200 lines. Split if it grows beyond 300.

### Imports

- Use path aliases: `@/primitives/tokens` not `../../primitives/tokens`
- Group imports: effect libs, then internal, then types
- No barrel files (`index.ts` re-exports). Import directly from the source file.

```typescript
// 1. Effect imports
import { Effect, Layer, Context } from "effect"
import { SqliteClient } from "@effect/sql-sqlite-bun"

// 2. Internal imports
import { sumTokens } from "@/primitives/tokens"
import { formatDate } from "@/primitives/time"

// 3. Type imports
import type { SessionSummary } from "@/primitives/types"
```

## Primitives (Layer 0)

The foundation. Every primitive must be:

1. **Pure** - same input, same output, no side effects
2. **Total** - handles all inputs, never throws (return discriminated results for partial functions)
3. **Small** - does one thing
4. **Typed** - input and output types are explicit, no implicit `any`

```typescript
// GOOD - pure, total, typed
export function safeParseJson(raw: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(raw) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "parse failed" }
  }
}

// BAD - throws, impure
export function parseJson(raw: string): unknown {
  return JSON.parse(raw) // throws on invalid input
}
```

### Schema Definitions

Use `@effect/schema` for data validation at boundaries (API params, JSON columns from DB).

```typescript
import { Schema } from "@effect/schema"

export const TokenRecord = Schema.Struct({
  input: Schema.Number,
  output: Schema.Number,
  reasoning: Schema.Number,
  cache: Schema.Struct({
    read: Schema.Number,
    write: Schema.Number,
  }),
})

export type TokenRecord = typeof TokenRecord.Type
```

Schema definitions live in `primitives/schemas/`. They are the shared vocabulary between layers.

## Services (Layer 1)

### Effect Service Pattern

Every service follows the same shape:

```typescript
// 1. Define the interface
export class StatsService extends Context.Tag("StatsService")<
  StatsService,
  {
    readonly getOverview: Effect.Effect<Overview, StatsError>
    readonly getDailyStats: (range: DateRange) => Effect.Effect<DailyStat[], StatsError>
  }
>() {}

// 2. Implement as a Layer
export const StatsServiceLive = Layer.effect(
  StatsService,
  Effect.gen(function* () {
    const db = yield* DashboardDb

    return {
      getOverview: Effect.gen(function* () {
        // ...
      }),
      getDailyStats: (range) => Effect.gen(function* () {
        // ...
      }),
    }
  }),
)
```

### Error Types

Typed errors for each service boundary:

```typescript
import { Data } from "effect"

export class SourceDbError extends Data.TaggedError("SourceDbError")<{
  readonly reason: string
  readonly cause?: unknown
}> {}

export class IngestionError extends Data.TaggedError("IngestionError")<{
  readonly reason: string
  readonly cause?: unknown
}> {}
```

### SQL Queries

- Always use parameterized queries via `@effect/sql` tagged template literals
- Never interpolate user input into SQL strings
- Prefer simple queries over complex joins (denormalized schema makes this easy)

```typescript
// GOOD
const rows = yield* sql`SELECT * FROM sessions WHERE project_id = ${projectId}`

// BAD
const rows = yield* sql.unsafe(`SELECT * FROM sessions WHERE project_id = '${projectId}'`)
```

## API (Layer 2)

### Route Handlers

Each route file exports a router fragment. Composed in a central router.

```typescript
// api/stats.ts
export const statsRoutes = HttpRouter.empty.pipe(
  HttpRouter.get("/api/stats/overview",
    Effect.gen(function* () {
      const stats = yield* StatsService
      const data = yield* stats.getOverview
      return HttpServerResponse.json(data)
    }),
  ),
)
```

### Response Format

Consistent JSON envelope:

```typescript
// Success
{ "data": { ... } }

// Error
{ "error": { "code": "NOT_FOUND", "message": "Session not found" } }
```

### Input Validation

Query params and path params validated with `@effect/schema` before use.

## UI (Layer 3)

### HTML Generation

Simple template functions. No template engine dependency.

```typescript
export function page(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="/static/styles.css">
</head>
<body>${content}</body>
</html>`
}
```

### CSS

- Single `styles.css` file (split only if it exceeds 500 lines)
- CSS custom properties for theming
- No utility classes - use semantic class names
- Mobile-first, but primarily designed for desktop (personal dashboard)

```css
:root {
  --color-bg: #0a0a0a;
  --color-text: #e0e0e0;
  --color-accent: #7c3aed;
  --radius: 6px;
  --gap: 1rem;
}
```

## Project Structure

```
platform-404/
  specs/                  # specifications (this document)
  src/
    primitives/           # Layer 0: pure functions + schemas
      schemas/            # @effect/schema definitions
      time.ts
      tokens.ts
      json.ts
      stats.ts
    services/             # Layer 1: Effect services
      source-db.ts        # read-only opencode.db connection
      dashboard-db.ts     # read-write dashboard.db connection
      ingestion.ts        # sync opencode -> dashboard
      stats.ts            # analytics queries
    api/                  # Layer 2: HTTP routes
      stats.ts
      sessions.ts
      health.ts
      router.ts           # composes all route fragments
    ui/                   # Layer 3: HTML + CSS
      templates/
        page.ts
        dashboard.ts
        session-detail.ts
      static/
        styles.css
    main.ts               # composition root
  test/
    primitives/           # unit tests for primitives
    services/             # integration tests
  Dockerfile
  docker-compose.yml
  package.json
  tsconfig.json
```

## Git Conventions

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): description`

**Types:**

| Type | Usage |
|------|-------|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test` | Adding or updating tests |
| `docs` | Documentation only |
| `chore` | Build, CI, tooling, deps |

**Scope** is the area of the codebase affected — typically a layer or module:

`primitives`, `services`, `api`, `ui`, `db`, `ci`, `deps`

**Examples:**

```
feat(api): add session detail endpoint
fix(services): handle empty token array in stats query
refactor(primitives): extract date bucketing into own module
test(services): add ingestion service integration tests
chore(deps): bump effect to 3.x
docs(specs): update testing standard
```

### General Rules

- Keep commits small and focused — one logical change per commit
- Write description in imperative mood: "add" not "added"
- No period at the end of the description
- Branch naming: `feat/thing`, `fix/thing`
