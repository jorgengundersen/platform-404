# Ralph Loop Prompt

Review @specs/* to understand the project specifications.
Review @AGENTS.md for coding standards.

Plan: @plans/current/initial-setup/test-infra-setup-plan.md
Study it.

Choose the most important ONE item from the plan and implement it.

Rules:
- ONE task per session. Do not do more than one.
- Interpretation: ONE task = ONE deliverable checkbox from the plan.
- TDD deliverable includes BOTH red + green in the same session (write failing test, then minimal implementation to pass).
- If the chosen deliverable is blocked by missing prerequisites, switch to the earliest blocking prerequisite checkbox instead.
- Anti-paralysis: when ambiguous, pick the smallest safe default aligned with specs/plan, implement it, and move on.
- Timebox ambiguity: 10 minutes max; then choose a default or switch to earliest blocking prerequisite.
- If still uncertain, write ONE short note in the plan under Discoveries ("Assumption: ...") and continue.
- Optimize for working red/green loop, not perfect certainty.
- Before making changes, use subagents to search the codebase first. Do not assume something is not implemented.
- Red/green TDD: write a failing test first, then implement to make it pass. (only exception is non-code tasks)
- After implementation, run tests for the code you changed.
- If tests pass, update plan (mark item done, add any new discoveries).
- Then use @commit subagent to commit changes.
- Do NOT implement placeholders or stubs. Full implementations only.
- Do NOT add dependencies unless absolutely necessary.
- When you learn something about how to build/test/run, update @AGENTS.md briefly. Be extreamly concise
- For any bugs you notice, document them in the plan even if unrelated to current work.
