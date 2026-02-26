I have my own devenv setup where i run my agentic development with.

See: https://github.com/jorgengundersen/devenv

I primerly use opencode as agent harnmess:
- [Opencode Docs](https://opencode.ai/docs/)
- [Opencode repo](https://github.com/anomalyco/opencode)


I want to create a personal dashboard that tracks my opencode usage.

things i want (examples only. i might want more stats):
- token usage
- sessions
- tokens per sessions
- prompts?

possibilities are endless.

persistant data that every devenv container uses are:

| Volume Name | Container Mount Point | XDG Variable | Purpose |
|-------------|----------------------|--------------|---------|
| `devenv-data` | `/home/devuser/.local/share` | `XDG_DATA_HOME` | Installed plugins, tree-sitter parsers, tool databases |
| `devenv-cache` | `/home/devuser/.cache` | `XDG_CACHE_HOME` | Download caches (uv, cargo, npm, pip) |
| `devenv-state` | `/home/devuser/.local/state` | `XDG_STATE_HOME` | Log files, command history, session state |

this is the data store that that opencode uses to store the data we need for our dashboard.


I want this to be simple and easy to maintain, with minimal dependencies.

Use bun, typescript, effect.js and css (just regular css). any recommendations for working with sqlite databases?
Only add dependencies only when absolutly needed. (example: we do not try to invent a database connection library)

this will run in a docker container and accessable from local host.

Build logic powerful primitives that are composable. the primitives should be "dumb code", nothing fancy.
the primitives are the lego bricks of our code.

then have a business layer, and then have the UI layer. i am open for suggestions or modifications if you have valid input.

The main goal for the architecture is to be solid, secure, easy to maintain, easy to test, easy to extend. Keep things stupid simple.

unit tests are primerly for the primitives. i prefer trophy testing model and black box testing.

about the data:
- read-only of the opencode data and respect WAL for the opencode.db
- i want this dashboard to store the data it reads and need on its own docker volume. if the devenv volumes get deleted, i want historical data needed for this dashboard to remain in a seperate database (and files if needed) in a docker volume.

I want you to create specs that we can use as a starting point for this project.

I want the following specs:

- `specs/architecture.md`
- `specs/coding-standard.md`
- `specs/testing-standard.md`

use subagents in parallel as needed for research and writing.
