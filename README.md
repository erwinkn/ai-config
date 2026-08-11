# AI configuration

This repository stores shared Claude, Codex, and agent configuration. It also
stores the setup needed to install the configuration on a Mac.

## Set up a Mac

Clone the repository and run the setup command:

```sh
git clone https://github.com/erwinkn/ai-config.git ~/Code/ai-config
cd ~/Code/ai-config
./setup
```

The command:

- installs Node.js through Homebrew when Node.js 18 or later is missing;
- creates the bare home mirror at `~/.ai-config`;
- installs the `ai` command in `~/.local/bin`;
- preserves existing files in `~/.local/state/ai-config/backups`;
- captures existing Claude and Codex values and skills as device-local data;
- renders the active Claude and Codex configuration files and skill packages; and
- adds `~/.local/bin` to `PATH` through `~/.zprofile`.

The setup does not install Claude Code, ChatGPT, or other external tools.
The `ai` command is a JavaScript program. It uses the pinned `smol-toml`
package to read and write Codex configuration.

## Configuration layers

Tracked shared settings:

```text
~/.config/ai-config/shared/claude.json
~/.config/ai-config/shared/codex.toml
```

Ignored device-local settings:

```text
~/.config/ai-config/local/claude.json
~/.config/ai-config/local/codex.toml
```

Generated active settings:

```text
~/.claude/settings.json
~/.codex/config.toml
```

Skills use the same three layers. Each skill directory is one package:

```text
~/.config/ai-config/shared/skills/agents/<name>/   # tracked
~/.config/ai-config/shared/skills/claude/<name>/   # tracked
~/.config/ai-config/local/skills/agents/<name>/    # ignored
~/.config/ai-config/local/skills/claude/<name>/    # ignored
~/.agents/skills/<name>/                           # generated
~/.claude/skills/<name>/                           # generated
```

The `agents` and `claude` targets are independent. A skill can exist in one
target only, or it can have different packages in both targets. A local skill
package replaces the complete shared package with the same name.

The skill manager file `~/.agents/.skill-lock.json` stays device-local. The
setup preserves it, but Git does not track it.

Local values override shared values. Their presence pins them on that device,
even when they equal the current shared value.

Capture direct Claude or Codex changes in the local layer:

```sh
ai capture
```

`ai capture` compares the active files and skills with private last-rendered
snapshots. It changes only the local settings and complete skill packages that
changed. Existing local intent remains in place. A deleted active skill gets a
local deletion marker in `.deletions.json`.

Apply shared and local settings to the active files:

```sh
ai apply
```

`ai apply` refuses to overwrite an active file or skill with uncaptured
changes. Run `ai capture` first if you want to keep those changes.

Configuration-writing commands use a process lock. A second command exits with
the owner PID instead of racing. A lock owned by a dead process is recovered
automatically. Raw `ai git` commands do not use this configuration lock.

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

Changes made in the active Claude or Codex files are always device-local. The
`ai sync` command adopts them locally but never promotes them to the tracked
shared layer. Share one local setting explicitly:

```sh
ai share codex model_reasoning_effort
```

This command moves the effective local value, object, or deletion into the
tracked shared file. It does not commit or push. Review the change, then publish
it explicitly with the normal Git workflow.

Skill commands use the same intent:

```sh
ai skills pin agents autoreview
ai skills reset agents autoreview
ai skills remove claude codex-review
ai skills share claude codex-review
```

`pin` copies the current active package into the local layer. It stays pinned
even when the shared package changes. `reset` removes the local override or
deletion marker. `remove` adds a local deletion marker. `share` promotes the
full local package or deletion to the tracked shared layer. These commands do
not commit or push.

To promote a setting to all devices, use the explicit share command, review the
tracked change, and publish it through the home mirror:

```sh
ai share codex model_reasoning_effort
ai git diff -- .config/ai-config/shared/codex.toml
ai git add .config/ai-config/shared/codex.toml
ai git commit -m "Share Codex reasoning effort"
ai git push
```

## Daily synchronization

On another device, update the home mirror and render the effective
configuration:

```sh
ai sync
```

`ai sync` captures changes made by Claude or Codex in the local layers before
it pulls. It then applies the new shared settings and skills and keeps the
device values and skill packages.

Inspect active files, local intent, and all tracked repository changes:

```sh
ai status
```

Git commands use the explicit `ai git` namespace:

```sh
ai git status
ai git diff
ai git log --oneline -10
ai git config --list
```

Use `ai git pull` only when you need a raw Git pull without capture or apply.
