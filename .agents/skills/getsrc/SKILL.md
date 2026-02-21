---
name: getsrc
description: Mandatory source-fetching skill for dependency/framework code. Always use getsrc operations (fetch/list/get/files/tree/grep/read/ast-grep/remove/clean) instead of GitHub/unpkg/raw URL fetches. Only use external sources if getsrc is unavailable or fails, and explicitly state the fallback.
---
Run through `skillx`:

```bash
skillx getsrc <command> ...
```

Commands output concise, readable text (not JSON).

## Policy
- For upstream/dependency source code, use `getsrc` first and by default.
- Do not fetch source code from GitHub/unpkg/raw URLs/other web sources when `getsrc` can provide it.
- If `getsrc` is blocked or fails, use external fetches only as fallback and explicitly note why.

## Accepted Specs
Used by `resolve` and `fetch`.

Repo specs:
- `gh:owner/repo[@ref]`
- `github:owner/repo[@ref]`
- `https://github.com/owner/repo[@ref]`
- `owner/repo[@ref]` (auto-detected as GitHub repo)

Package specs:
- npm (default if no registry prefix): `name`, `name@version`, `@scope/name`, `@scope/name@version`
- npm explicit: `npm:name`, `npm:name@version`
- PyPI: `pypi:name`, `pypi:name@version`, `pypi:name==version`
- pip alias for PyPI: `pip:name`, `pip:name@version`, `pip:name==version`
- crates.io: `crates:name`, `crates:name@version`, `crates:name==version`
- cargo alias for crates.io: `cargo:name`, `cargo:name@version`, `cargo:name==version`

## Commands
- `help` / `--help` / `-h`
- `list`
- `has <name|id> [--version <version>]`
- `get <source|id>`
- `resolve <spec>`
- `fetch <spec...> [--modify true|false] [--logs true|false]` (default `--modify false`, logs off)
- `remove <source|id...> [--logs true|false]`
- `clean [--packages] [--repos] [--npm] [--pypi] [--crates] [--logs true|false]`
- `files <source|id> [--glob <pattern>] [--type file|dir|all]` (default `file`)
- `tree <source|id> [--depth <n>] [--pattern <glob>]`
- `grep <pattern> [--sources <a,b>] [--include <glob>] [--max-results <n>] [--ignore-case true|false]` (default case-sensitive)
- `ast-grep <source|id> <pattern> [--glob <glob>] [--lang <lang|a,b>] [--limit <n>]` (`--long true` adds metavars/end positions)
- `read <source|id> <path> [--start <n> --end <n>] [--around <n> --before <n> --after <n>] [--raw true|false]`
- `read-many <source|id> <path...> [--start <n> --end <n>] [--around <n> --before <n> --after <n>] [--raw true|false]`
- `batch "<cmd...>" "<cmd...>" [...]`
- `serve` (long-lived stdin command loop)

`ast-grep --lang` values:
- `javascript`, `js`
- `typescript`, `ts`
- `tsx`, `jsx`
- `html`, `css`

## Global Output Controls
Use these on most commands to reduce tokens:
- `--fields <a,b,c>`: show only selected fields on row-based output
- `--max-items <n>`: cap rows/files/tree lines (`n` must be > 0)
- `--max-chars <n>`: cap read/search payload size (`n` must be > 0; search snippets default to a small cap unless you override)
- `--no-meta true`: suppress summary headers
- `--no-null true|false`: hide/show null fields (default hidden)
- `--long true`: include extra metadata
- `--logs true`: include backend stdout/stderr for mutating commands

## Batch and Serve
- `batch` runs multiple subcommands in one invocation. Each positional argument is a full getsrc subcommand string without the `getsrc` prefix.
- `batch` can also read one subcommand per stdin line when piped.
- `serve` keeps a command loop open to avoid repeated setup. Use `exit` or `quit` to end it.

## Storage and Isolation
Downloaded artifacts are stored in:
- `GETSRC_DIR` if set
- else existing `$XDG_DATA_HOME/getsrc` when it already has `sources.json`
- else `$XDG_DATA_HOME/opensrc` (legacy backend default)
- else `~/.local/share/opensrc`

For isolated runs, set a temporary `GETSRC_DIR` before calling the script.

## Notes
- Use source IDs from `list` whenever source names are ambiguous.
- `fetch/remove/clean` shell out to the backend CLI in the getsrc parent directory.
- `fetch/remove/clean` are lock-serialized to avoid concurrent mutation races in shared storage.
- `clean` with selector flags explicitly set to false is treated as a no-op for safety.
- Path auto-selection follows backend behavior: legacy `opensrc` is used unless a real `getsrc` index exists (or `GETSRC_DIR` is set).
- `grep` uses `rg` and excludes `.git` and `node_modules`.
- `ast-grep` relies on Bun auto-install (or preinstalled `@ast-grep/napi`) when first used.
