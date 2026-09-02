# AI configuration

Home-directory config for Claude, Codex, Cursor, and agent skills.
The Mac installer lives here too.

## Set up a Mac

```sh
git clone https://github.com/erwinkn/ai-config.git ~/Code/ai-config
cd ~/Code/ai-config
./setup
```

The command:

- installs Node.js through Homebrew when Node.js 18 or later is missing
- creates the bare home mirror at `~/.ai-config`
- installs `ai` as `~/.local/bin/ai` -> `~/.config/ai/bin/ai`
- preserves existing files in `~/.local/state/ai/backups`
- captures existing Claude and Codex settings as device-local overlays
- renders the active Claude and Codex files
- adds `~/.local/bin` to `PATH` through `~/.zprofile`

It does not install Claude Code, ChatGPT, or other external tools.
`ai` is a Node program. It uses the pinned `smol-toml` package for Codex config.

Windows: `scripts/setup-windows-ai.ps1` installs the bare mirror and the `ai`
PowerShell function. Node 18+ is required so Windows `ai` matches macOS.
Git goes through `ai git`.

## Skills

Tracked agent skills:

```text
~/.agents/skills/<name>/
```

Claude aliases, not a second copy:

```text
~/CLAUDE.md            -> AGENTS.md
~/.claude/CLAUDE.md    -> ../AGENTS.md
~/.claude/skills       -> ../.agents/skills
```

`skills-lock.json` at the repo root is the vercel-labs/skills lock for those
packages. Regen hashes after you add or edit a skill tree.

`.agents/.skill-lock.json` is a different file. The device skill manager owns
it. Setup preserves it. Git ignores it.

## Cursor estack

Cursor ships estack as a plugin. Skills and agents live under `.cursor/`.
Marketplace `source` is `.cursor`, so that directory is the plugin root.

```text
/add-plugin erwinkn/ai-config
```

This is the Cursor plugin packaging, not a second skill tree. Keep a
pstack-faithful estack there. Personal and agent skills go in
`.agents/skills`. Do not mix the two.

The home checkout still writes `~/.cursor/skills` and `~/.cursor/agents`.
Other Cursor user-data under `~/.cursor` stays untracked. If you both sync
the home mirror and install the plugin, `/erwin-mode` will appear twice.
Prefer the plugin install.

Local fallback:

```sh
mkdir -p ~/.cursor/plugins/local
ln -sfn /path/to/ai-config/.cursor ~/.cursor/plugins/local/estack
```

## Settings layers

Tracked shared settings:

```text
~/.config/ai/shared/claude.json
~/.config/ai/shared/codex.toml
```

Ignored device-local settings:

```text
~/.config/ai/local/claude.json
~/.config/ai/local/codex.toml
```

Generated active settings:

```text
~/.claude/settings.json
~/.codex/config.toml
```

Local values override shared values. Their presence pins them on that device,
even when they equal the current shared value.

Capture direct Claude or Codex changes in the local layer:

```sh
ai capture
```

`ai capture` compares the active files with private last-rendered snapshots.
It changes only the local settings that changed. Existing local intent stays
in place.

Apply shared and local settings to the active files:

```sh
ai apply
```

`ai apply` refuses to overwrite an active file with uncaptured changes.
Run `ai capture` first if you want to keep those changes.

Configuration-writing commands use a process lock. A second command exits with
the owner PID instead of racing. A lock owned by a dead process is recovered
automatically. Raw `ai git` commands do not use this lock.

Pin the current active value:

```sh
ai pin codex model_reasoning_effort
```

Pin a specific string or typed JSON value. An explicitly pinned JSON object
replaces the shared object at that path:

```sh
ai pin codex model_reasoning_effort --value high
ai pin codex agents max_concurrent_threads_per_session --json-value 10
```

Each word after the tool name is one path segment. Reset a path to shared
configuration, or remove it only on this device:

```sh
ai reset codex model_reasoning_effort
ai remove codex mcp_servers massive
```

Deletion markers are stored under `__ai_config.delete` in the ignored local
file. This metadata is not written to the active Claude or Codex files.

Changes made in the active Claude or Codex files are always device-local.
`ai sync` adopts them locally but never promotes them to the tracked shared
layer. Share one local setting explicitly:

```sh
ai share codex model_reasoning_effort
```

This command moves the effective local value, object, or deletion into the
tracked shared file. It does not commit or push. Review the change, then
publish it with the normal Git workflow.

```sh
ai share codex model_reasoning_effort
ai git diff -- .config/ai/shared/codex.toml
ai git add .config/ai/shared/codex.toml
ai git commit -m "Share Codex reasoning effort"
ai git push
```

## Daily synchronization

On another device, update the home mirror and render the effective
configuration:

```sh
ai sync
```

`ai sync` captures Claude or Codex changes in the local layer before it
pulls. It then applies the new shared settings and keeps the device values.

Inspect active files, local intent, and all tracked repository changes:

```sh
ai status
```

Show which active setting paths changed since the last render.
Configuration changes include the previous and current values:

```sh
ai diff
```

Git commands use the explicit `ai git` namespace:

```sh
ai git status
ai git diff
ai git log --oneline -10
ai git config --list
```

Use `ai git pull` only when you need a raw Git pull without capture or apply.
