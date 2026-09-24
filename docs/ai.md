# Sync this configuration across devices

This repository is checked out directly into the home directory of each
device. The Git data lives in `~/.ai-config` and the work tree is `$HOME`, so
skills, `AGENTS.md`, and the other tracked files are plain files you edit in
place. The `ai` command wraps that checkout and generates the settings files
that differ per device.

## Set up a device

Clone the repository anywhere, then run setup from the clone. Setup needs
Node.js 18 or later.

```sh
git clone https://github.com/erwinkn/ai-config.git ~/Code/ai-config
~/Code/ai-config/.config/ai/bin/setup-unix
```

On Windows, run `.config/ai/scripts/setup-windows-ai.ps1` from the clone.

Setup checks the repository out into `$HOME`. When a tracked file already
exists with different content, setup first copies it to
`~/.local/state/ai/backups/<timestamp>/`. It keeps the device's current Claude
and Codex settings as local overrides, installs `ai` in `~/.local/bin`, and
adds that directory to `PATH`. After setup, the clone is no longer needed.

## Share a change

Edit tracked files in place, then commit and push:

```sh
ai git status
ai git add ~/.agents/skills/<name>
ai git commit -m "<message>"
ai git push
```

`ai git status` hides untracked files, because the work tree is the whole
home directory. Add new files by path.

On each other device:

```sh
ai sync
```

`ai sync` records direct edits to the device's settings first, then fetches,
fast-forwards, and regenerates the settings files. It takes no arguments.

## Claude and Codex settings

`~/.claude/settings.json` and `~/.codex/config.toml` are generated. Each one
is the shared file in `.config/ai/shared/` (`claude.json`, `codex.toml`) with
the device's local layer from `.config/ai/local/` on top. Git never tracks the
local layer.

| Command | Effect |
| --- | --- |
| `ai status` | Shows whether the settings files match the last render, and which local overrides exist. |
| `ai diff` | Shows direct edits to the settings files since the last render. |
| `ai capture` | Records those direct edits as local overrides. |
| `ai share <tool> <key...>` | Moves a local value into the shared file. Commit and push it next. |
| `ai pin <tool> <key...> [--value <v> \| --json-value <json>]` | Keeps a value on this device only. |
| `ai reset <tool> <key...>` | Drops the local override, so the shared value applies. |
| `ai remove <tool> <key...>` | Deletes the setting on this device, even when the shared file has it. |
| `ai apply` | Regenerates the settings files. |

`<tool>` is `claude` or `codex`. A key is a path of separate words, for
example `ai share claude permissions defaultMode`.

A common case: you change a setting in the Claude or Codex app, then run
`ai share claude <key...>`, commit, and push. The other devices get it at
their next `ai sync`.

## MCP servers

`ai` also manages MCP servers for Claude, Cursor, Devin, OpenCode, and Grok
Build. See [harness-config.md](harness-config.md).

## BB preferences

`ai bb` applies selected BB preferences from `.config/ai/shared/bb.json`:
general settings, experiments, custom instructions, and the plugin inventory.
It needs a running BB server.

```sh
ai bb plan                      # preview the changes and print a token
ai bb apply --expect <token>    # apply exactly that preview
ai bb status
```

Apply stops when BB changed after the plan. It installs missing plugins and
enables or disables plugins to match the file. It never updates, removes, or
replaces a plugin. There is no export from live BB: edit `bb.json` by hand.

Device overrides go in `.config/ai/local/bb.json`. Start from
`.config/ai/examples/bb.local.json`. A local plugin entry set to `null` leaves
that plugin unmanaged on the device.

## Installation versions

`.config/ai/install-version` records the home layout that the repository
expects, and `~/.local/state/ai-config/install-version` records the layout of
the device. When a commit changes the layout, `ai sync` refuses it. Run setup
again from an updated clone.

## Tests

```sh
cd ~/.config/ai && npm test
```

CI runs the tests on Linux and macOS, and runs the Windows setup on Windows.
