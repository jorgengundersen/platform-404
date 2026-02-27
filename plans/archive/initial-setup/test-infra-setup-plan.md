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

- [x] `bun init` (`package.json`)
- [x] Install runtime deps: `effect`, `@effect/platform`, `@effect/platform-bun`, `@effect/schema`, `@effect/sql`, `@effect/sql-sqlite-bun` (`package.json`, `bun.lock`)
- [x] Install dev deps: `typescript`, `@types/bun`, `@biomejs/biome` (`package.json`, `bun.lock`)
- [x] Create `tsconfig.json` -- strict, path aliases `@/*`, Bun-compatible (`tsconfig.json`)
- [x] Create `biome.json` -- formatting + lint rules (no `any`, etc.) (`biome.json`)
- [x] Scaffold dirs: `src/{primitives,services,api,ui}`, `test/{primitives,services,api}` (dirs)
- [x] Add npm scripts: `typecheck`, `lint`, `format`, `format:check`, `check`, `test`, `validate` (`package.json`)
- [x] Seed TDD cycle: `math.add` (prove red/green works end-to-end)
  - [x] Red: `test/primitives/math.test.ts` fails for the right reason; run `bun test`
  - [x] Green: `src/primitives/math.ts` minimal `add` implementation; run `bun test`
- [x] Run full validation: `bun run validate`
- [x] Install lefthook: `bun add -d lefthook` (`package.json`)
- [x] Create `lefthook.yml` -- pre-commit config (`lefthook.yml`)
- [x] `lefthook install` -- activate git hook (`.git/hooks/pre-commit`)
- [x] Verify: test commit triggers all 4 checks

## Pre-commit Hook (lefthook)

Runs sequentially, fails fast:

- [x] `bun run format:check` -- Biome formatting
- [x] `bun run lint` -- Biome linting
- [x] `bun run typecheck` -- `tsc --noEmit`
- [x] `bun test` -- all tests

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

## Discoveries

- [x] `bun init` creates `index.ts`, `README.md`, `tsconfig.json`, `package.json`, `bun.lock`.
- [x] `bun test` fails when no test files exist.
- [x] `bun test` errors when no matching test files.
- [x] `bun test` errors when no matching test files (re-verified while adding scripts).
- [x] Scripts in `package.json` already match plan item but checkbox still unchecked.
- [x] `bun run validate` fails when biome format check fails.
- [x] `bun run validate` currently fails due to `opencode/opencode.jsonc` and `index.ts` formatting.
