---
description: Create a new implementation plan
---

Create a new plan file modeled after @plans/archive/initial-setup/implementation_plan.md (structure, tone, concision) and consistent with @plans/current/ingestion-vertical-slice/implementation_plan.md.

Deduce target directory (only ask if deduction fails):
- If `$1` is provided, use it.
- Else if the request references a `research.md` path, use that file's directory.
- Else, pick/create a directory under `plans/current/` that fits the request:
  - Prefer an existing matching directory if it's obvious.
  - Otherwise create `plans/current/<kebab-case-slug>` from the request's title/topic.
- If you can't deduce a safe directory, ask the user: "What directory should I create `implementation_plan.md` in?" and wait.

Input
- `$1` OPTIONAL: target directory (repo-relative), example: `plans/current/ingestion-vertical-slice`

Output path
- Create exactly one file: `<target-dir>/implementation_plan.md`

Requirements for `implementation_plan.md`
- First line: `# <Title> (Ralph Loop / TDD)`
- Include sections in this order and with these exact headings:
  - `Goal: ...` (single line)
  - `## Non-goals (explicitly NOT now)` (3-8 bullets)
  - `## Task Queue (pick top-most incomplete)`
  - `## Target Structure (only as needed by tasks)`
  - `## Working State Definition`
  - `## Discoveries`
  - `## Bugs`
- Task Queue rules:
  - Use markdown checklist bullets only: `- [ ]` / `- [x]`
  - Each task starts with `TDD:` and is independently testable
  - Order tasks by dependency; smallest vertical slice first
  - Keep scope tight; add explicit non-goals instead of vague tasks
  - Prefer small red/green loops (ONE test then ONE implementation); avoid bulk tasks

Do the work
1) Determine `<target-dir>` using the deduction rules.
2) Create the directory `<target-dir>/` if missing.
3) Write `<target-dir>/implementation_plan.md`.
3) Do not modify other files.

Finish by printing only the created file path.
