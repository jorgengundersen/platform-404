Review @README.md for project overview. Review @specs/README.md for spec index.
Review @AGENTS.md for agent rules, bd workflow, and commit conventions.

Check ready work: bd ready --json (exclude issues with label experiment)

Pick the highest-priority unblocked issue and claim it:
scripts/bd-worker-transition claim <id> --json

Then complete the work per AGENTS.md rules.

Session rules:

- ONE task per session.
- Anti-paralysis: when ambiguous, pick the smallest safe default, implement,
  move on.
- Deleting the whole repo is never a solution.
- Commit and push before ending session.

Prompt library:

- .ralph/investigator/PROMPT.md — for investigation/analysis tasks (uses --label
  experiment,released)
- .ralph/validator/PROMPT.md — for validation tasks (uses --label
  experiment and metadata phase filter)
