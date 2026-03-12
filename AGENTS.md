- When I ask you to create or update specs, do not implement anything.
- Be extremely concise and sacrifice grammar for the sake of concision.
- red/green TDD for any development. ONE test and ONE implementation. No bulk-test and bulk-implementation
- commit when issue is complete to trigger pre-commit hook. Fix any issues from checks and tests
- `bun init` creates `index.ts`, `README.md`, `tsconfig.json`, `package.json`, `bun.lock`.
- `bun test` fails if no test files.
- lefthook config lives in `lefthook.yml` with pre-commit jobs.
- `bun run validate` fails if biome format check fails.
- Env var tests require try/finally cleanup: save original, restore after to prevent cross-test pollution.

## Dev and Test Data Isolation

**CRITICAL: Live data must NEVER be used in dev or test. No exceptions.**

### Correct dev workflow

Always use `make dev`. Never run `bun run dev` directly.

```bash
make dev        # wipes both dev DBs, seeds fresh dummy data, starts server
make test       # runs bun test (all tests use :memory: or /tmp/ DBs)
```

`make dev` sets:
- `OPENCODE_DB_PATH=.data/opencode.dev.db` — seeded with dummy data, wiped fresh on every run
- `DASHBOARD_DB_PATH=.data/dashboard.dev.db` — wiped fresh on every run

### Rules for agents

- NEVER run `bun run dev` directly — always `make dev`
- NEVER set `OPENCODE_DB_PATH` to any path outside `.data/` in this repo
- NEVER set `OPENCODE_DB_PATH` to `~/.local/share/opencode/opencode.db` or any live DB path
- NEVER set `DASHBOARD_DB_PATH` to `/data/dashboard.db` (that is the Docker/prod path)
- Both `OPENCODE_DB_PATH` and `DASHBOARD_DB_PATH` are required — the app will throw if either is missing (no fallback)
- If you need a running server for screenshots or testing, use `make dev`

### Why this matters

The ingestion loop copies all data from `OPENCODE_DB_PATH` into `DASHBOARD_DB_PATH`. If a live DB is used as the source, all real user sessions are permanently written into `DASHBOARD_DB_PATH` and persist across restarts (the cursor mechanism means the contamination is irreversible without wiping the DB).

`make dev-db` wipes both dev DBs on every run precisely to prevent this.

### Running tests

Tests are always safe: every test uses `:memory:` SQLite or `/tmp/test-*-<timestamp>.db` with cleanup. No test reads from `process.env` without a fully isolated env object.

```bash
make test       # preferred
bun test        # equivalent
```

<!-- BEGIN BEADS INTEGRATION -->
## Issue Tracking with bd (beads)

**IMPORTANT**: This project uses **bd (beads)** for ALL issue tracking. Do NOT use markdown TODOs, task lists, or other tracking methods.

### Why bd?

- Dependency-aware: Track blockers and relationships between issues
- Git-friendly: Dolt-powered version control with native sync
- Agent-optimized: JSON output, ready work detection, discovered-from links
- Prevents duplicate tracking systems and confusion

### Quick Start

**Check for ready work:**

```bash
bd ready --json
```

**Create new issues:**

```bash
bd create "Issue title" --description="Detailed context" -t bug|feature|task -p 0-4 --json
bd create "Issue title" --description="What this issue is about" -p 1 --deps discovered-from:bd-123 --json
```

**Claim and update:**

```bash
bd update <id> --claim --json
bd update bd-42 --priority 1 --json
```

**Complete work:**

```bash
bd close bd-42 --reason "Completed" --json
```

### Issue Types

- `bug` - Something broken
- `feature` - New functionality
- `task` - Work item (tests, docs, refactoring)
- `epic` - Large feature with subtasks
- `chore` - Maintenance (dependencies, tooling)

### Priorities

- `0` - Critical (security, data loss, broken builds)
- `1` - High (major features, important bugs)
- `2` - Medium (default, nice-to-have)
- `3` - Low (polish, optimization)
- `4` - Backlog (future ideas)

### Workflow for AI Agents

1. **Check ready work**: `bd ready` shows unblocked issues
2. **Claim your task atomically**: `bd update <id> --claim`
3. **Work on it**: Implement, test, document
4. **Discover new work?** Create linked issue:
   - `bd create "Found bug" --description="Details about what was found" -p 1 --deps discovered-from:<parent-id>`
5. **Complete**: `bd close <id> --reason "Done"`

### Auto-Sync

bd automatically syncs via Dolt:

- Each write auto-commits to Dolt history
- Use `bd dolt push`/`bd dolt pull` for remote sync
- No manual export/import needed!

### Important Rules

- ✅ Use bd for ALL task tracking
- ✅ Always use `--json` flag for programmatic use
- ✅ Link discovered work with `discovered-from` dependencies
- ✅ Check `bd ready` before asking "what should I work on?"
- ❌ Do NOT create markdown TODO lists
- ❌ Do NOT use external issue trackers
- ❌ Do NOT duplicate tracking systems

For more details, see README.md and docs/QUICKSTART.md.

<!-- END BEADS INTEGRATION -->

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
