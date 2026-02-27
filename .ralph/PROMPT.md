# Ralph Loop Prompt

Review @specs/* to understand the project specifications.
Review @AGENTS.md for coding standards.

Check if a `fix_plan.md` exists at root. If it does, study it. If not, create one by comparing specs against current implementation - list what's missing as bullet points sorted by priority.

Choose the most important ONE item from fix_plan.md and implement it.

Rules:
- ONE task per session. Do not do more than one.
- Before making changes, search the codebase first. Do not assume something is not implemented.
- Red/green TDD: write a failing test first, then implement to make it pass.
- After implementation, run tests for the code you changed.
- If tests pass, update fix_plan.md (mark item done, add any new discoveries).
- Then: `git add -A && git commit -m "<description of change>"`
- Do NOT implement placeholders or stubs. Full implementations only.
- Do NOT add dependencies unless absolutely necessary.
- When you learn something about how to build/test/run, update @AGENTS.md briefly.
- For any bugs you notice, document them in fix_plan.md even if unrelated to current work.
