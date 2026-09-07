# Shared harness configuration

`ai apply` restores shared MCP definitions for Claude, Cursor, Devin, OpenCode,
and Grok Build. Codex continues to use `shared/codex.toml`. Computer Use stays
enabled through the Codex plugin configuration.

The new fragments live in `.config/ai/shared/harnesses/`.

| Fragment | Native file | Supported fields |
| --- | --- | --- |
| `claude-mcp.json` | `~/.claude.json` | HTTP `mcpServers` |
| `cursor.json` | `~/.cursor/mcp.json` | Remote `mcpServers` |
| `devin.json` | `~/.config/devin/mcp_config.json` | HTTP `mcpServers` |
| `opencode.json` | `~/.config/opencode/opencode.json` | Remote `mcp` |
| `grok.json` | `~/.grok/config.toml` | Remote `mcp_servers` and selected `ui` preferences |

The Grok UI fields are `max_thoughts_width`, `fork_secondary_model`, `yolo`,
and `compact_mode`. Installer state, marketplace installation flags, histories,
and account data stay local. Grok's shared fragment uses JSON; `ai` writes native
TOML when it applies the settings.

## Share a change

Edit a fragment directly, or import supported fields from the native file:

```sh
ai harness share claude-mcp
ai harness share cursor
ai harness share devin
ai harness share opencode
ai harness share grok
ai apply
ai status
```

Run only the share commands for the tools you intend to update. Sharing is
explicit. `ai capture` still captures only Claude settings and Codex settings;
it does not import native harness files into shared fragments.

Review and commit the fragments with `ai git`. On another device, `ai sync`
applies them after the Git update. Initial setup uses the same renderer.
`ai harness status` checks the fragments without showing setting values.

## Preserve local state

`ai` manages each server entry and each selected UI field. It preserves other
native fields, including Claude project history and account state. It also
preserves MCP entries that the fragments have never managed. Thus this does
not enforce an Executor-only policy on a device with other local servers.

If an existing managed field differs from the last applied value and the new
shared value, apply stops before writing configuration. Promote a supported
local change with `ai harness share <tool>`, or resolve that field locally.
The first apply also stops on a conflicting existing value.

To remove a managed server or UI field, remove its entry from the fragment,
then run `ai apply`. Keep the fragment file, even when it is `{}`, so `ai` can
remove entries recorded in its local baseline. Deleting the fragment file
stops management and leaves the native file unchanged.

Native files and OAuth stores are ignored by Git. Shared MCP definitions accept
only HTTPS URLs and the documented transport/enabled fields. Sharing rejects
headers, environment variables, local commands, and other unsupported fields.
URLs with user credentials, query parameters, or fragments are rejected. Review
URLs before committing: a credential embedded in a URL path cannot be identified
reliably. `ai` does not read separate credential stores or perform OAuth login.

JSON and TOML formatting may change when `ai` updates a native file. Unmanaged
values are preserved. This includes credentials already stored in the same native
file; those values are never written to the shared fragment or baseline.
The renderer checks for native edits again immediately before replacement.
Native apps do not share the `ai` lock, so avoid editing their configuration
while apply runs; the file system does not provide a portable compare-and-swap.

Claude.ai account connectors are separate from the local MCP list. Manage them
in Claude's connector settings. Each device must authorize Executor separately.
