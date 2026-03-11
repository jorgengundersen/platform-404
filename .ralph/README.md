## .ralph/

Ralph session runner for the dhub-batch-spec project.

| Path | Description | |------|-------------| | `DEFAULT_PROMPT.md` | Generic
entry-point prompt for any session type | | `ralph-loop` | General loop script;
stop via `.ralph/general.DONE`; logs in `.ralph/logs/general/` | |
`test-logging.sh` | Logging test helper | | `general.DONE` | Graceful stop
signal for general loop | | `logs/` | Per-loop log dirs (`general/`,
`investigator/`, `validator/`) | | `investigator/ralph-loop` | Investigator
loop; stop via `.ralph/investigator/DONE`; logs in `.ralph/logs/investigator/` |
| `investigator/PROMPT.md` | Investigator runner prompt | |
`validator/ralph-loop` | Validator loop; stop via `.ralph/validator/DONE`; logs
in `.ralph/logs/validator/` | | `validator/PROMPT.md` | Validator runner prompt
|
