# Test Infrastructure Setup Plan

## Goal

Establish the testing facility so red/green TDD can begin. Pre-commit hook enforces formatting, linting, typechecking, and tests on every commit.

## Tooling Choices

| Concern | Tool | Why |
|---------|------|-----|
| Runtime | Bun | per spec |
| Test runner | `bun:test` | per spec |
| Format + Lint | Biome | single Rust binary, ~100x faster than ESLint+Prettier, minimal config |
| Typecheck | `tsc --noEmit` | strict mode per coding-standard spec |
| Git hooks | lefthook | single Go binary, zero JS deps, simple YAML config |

## Steps

| # | Task | Files |
|---|------|-------|
| 1 | `bun init` | `package.json` |
| 2 | Install runtime deps: `effect`, `@effect/platform`, `@effect/platform-bun`, `@effect/schema`, `@effect/sql`, `@effect/sql-sqlite-bun` | `package.json`, `bun.lock` |
| 3 | Install dev deps: `typescript`, `@types/bun`, `@biomejs/biome` | `package.json`, `bun.lock` |
| 4 | Create `tsconfig.json` -- strict, path aliases `@/*`, Bun-compatible | `tsconfig.json` |
| 5 | Create `biome.json` -- formatting + lint rules (no `any`, etc.) | `biome.json` |
| 6 | Scaffold dirs: `src/{primitives,services,api,ui}`, `test/{primitives,services,api}` | directories |
| 7 | Add npm scripts: `typecheck`, `lint`, `format`, `format:check`, `check`, `test`, `validate` | `package.json` |
| 8 | Write seed primitive: `src/primitives/math.ts` -- pure `add` function | `src/primitives/math.ts` |
| 9 | Write seed test: `test/primitives/math.test.ts` -- test `add`, run `bun test` | `test/primitives/math.test.ts` |
| 10 | Run full validation: `bun run validate` | -- |
| 11 | Install lefthook: `bun add -d lefthook` | `package.json` |
| 12 | Create `lefthook.yml` -- pre-commit config | `lefthook.yml` |
| 13 | `lefthook install` -- activate git hook | `.git/hooks/pre-commit` |
| 14 | Verify: test commit triggers all 4 checks | -- |

## Pre-commit Hook (lefthook)

Runs sequentially, fails fast:

1. `bun run format:check` -- Biome formatting
2. `bun run lint` -- Biome linting
3. `bun run typecheck` -- `tsc --noEmit`
4. `bun test` -- all tests

## package.json Scripts

```json
{
  "typecheck": "tsc --noEmit",
  "lint": "biome lint .",
  "format": "biome format --write .",
  "format:check": "biome format .",
  "check": "biome check .",
  "test": "bun test",
  "validate": "bun run format:check && bun run lint && bun run typecheck && bun test"
}
```

## Directory Structure (after completion)

```
src/
  primitives/     # Layer 0 -- pure functions, no deps
  services/       # Layer 1 -- Effect services + layers
  api/            # Layer 2 -- HTTP routes
  ui/             # Layer 3 -- HTML + CSS
test/
  primitives/     # mirrors src/primitives
  services/       # mirrors src/services
  api/            # mirrors src/api
```

## Seed Files

**`src/primitives/math.ts`** -- trivial pure function to validate infra works.

**`test/primitives/math.test.ts`** -- corresponding test.

These exist only to prove the TDD loop works end-to-end. Replace with real primitives as development begins.
