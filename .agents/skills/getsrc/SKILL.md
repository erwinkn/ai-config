---
name: getsrc
description: Fetch and query dependency source code without codemode MCP. Use when the task needs getsrc-style operations (fetch/list/get/files/tree/grep/read/ast-grep/remove/clean) from a local script.
---
Run through `skillx`:

```bash
skillx getsrc <command> ...
```

All commands print JSON.

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
- `has <name> [--version <version>]`
- `get <name>`
- `resolve <spec>`
- `fetch <spec...> [--modify true|false]` (default `--modify false`)
- `remove <name...>`
- `clean [--packages] [--repos] [--npm] [--pypi] [--crates]`
- `files <source> [--glob <pattern>]` (default `**/*`)
- `tree <source> [--depth <n>] [--pattern <glob>]` (default depth `3`)
- `grep <pattern> [--sources <a,b>] [--include <glob>] [--max-results <n>]` (defaults: `--include **/*`, `--max-results 100`)
- `ast-grep <source> <pattern> [--glob <glob>] [--lang <lang|a,b>] [--limit <n>]` (defaults: `--glob **/*`, `--limit 1000`)
- `read <source> <path>`
- `read-many <source> <path...>` (supports literal paths and glob paths)

`ast-grep --lang` values:
- `javascript`, `js`
- `typescript`, `ts`
- `tsx`, `jsx`
- `html`, `css`

## Storage and Isolation
Downloaded artifacts are stored in:
- `GETSRC_DIR` if set
- else `$XDG_DATA_HOME/getsrc`
- else `~/.local/share/getsrc`

For isolated runs, set a temporary `GETSRC_DIR` before calling the script.

## Notes
- `<source>` is an exact source name from `list` (example: `github.com/owner/repo`).
- `fetch/remove/clean` shell out to the backend CLI in the getsrc parent directory.
- `grep` uses `rg` and excludes `.git` and `node_modules`.
- `ast-grep` auto-installs `@ast-grep/napi` on first use (into this skill directory).
