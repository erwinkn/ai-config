# Portable BB configuration

`ai bb` manages selected BB preferences through public BB commands. It is
separate from `ai apply`, `ai capture`, and `ai sync`. Those commands do not
read, export, or apply BB state. This workflow needs Node.js 18 or later and a
running BB server. The public command contract was checked with BB 0.42.1.

## Preview and apply

From this checkout, on macOS or Linux:

```sh
export AI_CONFIG_HOME="$PWD/.config/ai-config"
node .config/ai-config/bin/ai bb status
node .config/ai-config/bin/ai bb plan
node .config/ai-config/bin/ai bb apply --expect <token-from-plan>
node .config/ai-config/bin/ai bb status
```

Replace `<token-from-plan>` with the `token` value in the reviewed plan. Plan
and status have the same JSON output. They do not write files or change BB.
Exit code 0 means the plan is valid, including when changes are needed; 2
means a source conflict or another blocker; 1 means an error. An empty
`operations` list and no blockers mean the selected state is current.

Apply reads BB again and requires the same desired values, selected live
values, and server identity. A stale token stops the command before any BB
change. It then applies only the listed operations and reads BB again to
check the result. The token is a stale-preview check, not a secret or an
authorization credential. Review the full plan, including instruction text.
Do not store secrets in instructions.

BB chooses the server target through its own CLI environment. Before a first
apply, run `bb status` and `bb settings show` directly to check that target.
`ai bb` uses the local `cliPath` override, then `BB_CLI`, then `bb` on PATH.
It does not change the BB target or enroll a machine. The plan token includes
the server URL, data directory, and primary host ID without exporting those
values in plan output or the shared manifest.

## Shared and local intent

The tracked source is `.config/ai-config/shared/bb.json`. It contains only
selected non-secret preferences, instruction text, and the desired plugin
inventory. Edit this file and review its Git diff before publication. There
is no automatic export from live BB.

Machine overrides go in the ignored `.config/ai-config/local/bb.json`:

```sh
mkdir -p "$AI_CONFIG_HOME/local"
cp .config/ai-config/examples/bb.local.json "$AI_CONFIG_HOME/local/bb.json"
```

Edit the example before use. Remove `cliPath` to use BB's normal CLI. Each
local general or experiment key replaces the matching shared value. Local
instruction text replaces all shared instruction text. A local plugin entry
replaces the whole matching source entry. A local plugin value of `null`
stops management of that plugin on this machine; it does not disable or
remove the live plugin. Omitted settings and plugins remain unchanged.

The supported general keys are `showKeyboardHints`,
`steerActiveThreadOnEnter`, `showUnhandledProviderEvents`, `streamerMode`,
`managedBranchPrefix`, `providerOrder`, and `defaultProviderId`. The supported
experiment keys are `changelogPreview`, `editMessages`, `mobileApp`,
`sidebarProgressiveDisclosure`, and `timelineWindowing`. Unknown keys and
wrong types stop the command before it calls BB. This fixed list prevents an
accidental config-file import from becoming an apply operation.

## Plugins

Each desired plugin has an ID and a `source`. Built-in sources use
`builtin:<id>` and follow the installed BB release. Git sources must use
`git:https://github.com/<owner>/<repo>.git@<full-40-character-commit-SHA>`
or `git:https://github.com/<owner>/<repo>.git@main`. The Devin entry tracks
`main`. Other branch names remain unsupported.
Git repositories must expose a `.bb/plugins.json` entry whose name matches
the desired ID. Install uses `--plugin <id>`, the verified Devin install
form. `subdirectory` records the expected resolved directory; the final
state check verifies it. Moving tags, local source paths, embedded
credentials, and parent-directory paths are rejected. Keep credentials for the private repository in the host's Git
credential system. The workflow does not install or copy credentials.

Every inventory entry means desired enabled state; disabled intent is not
supported. Missing plugins are installed. A listed plugin that is currently
disabled is enabled.
BB enables new plugins by default. Plugin code has full trust, so review the
source commit before apply. Source conflicts stop the entire apply. Use
`bb plugin source <id> --json` to inspect a conflict. If replacement is
intended, review BB's source-change procedure first. BB documents removal
and a fresh install for a pinned source change; removal deletes plugin
settings, secrets, and schedules. Do not use removal as an automatic upgrade.
A local null override can leave an existing pin unmanaged until migration.
Make a new plan after any manual source change. No plugin is automatically
updated, disabled, removed, or replaced. Removing an entry from the manifest only
stops management of it.

For a new install, `@main` selects the branch at install time. It does not
pin the code reviewed during plan. For an installed `@main` source, plan
shows `trackingPlugins` with the installed resolved commit and an update
command. The plan token changes if that resolved value changes. Plan does
not fetch the remote branch or claim that the installed commit is latest.
To check and apply a later compatible branch update explicitly:

```sh
bb plugin outdated --json
bb plugin update erwin-devin
```

Then run `ai bb plan` again. `ai bb apply` does not update an installed
tracking plugin. BB checks release compatibility, so an incompatible newest
commit can be blocked. To install the desired source on a fresh BB server:

```sh
bb plugin install git:https://github.com/erwinkn/bb-plugins.git@main --plugin erwin-devin
```

The inventory is a selected baseline, not a copy of all installed plugins.
It excludes the Hello test plugin and the old Devin branding plugins.
An existing local Devin development install can remain local with an
`"erwin-devin": null` override. The dedicated provider uses the executable
name `devin` on PATH. For a different executable location, use the public
plugin setting on that host after installation:

```sh
bb plugin config erwin-devin set command /path/to/devin
```

This plugin setting is not exported or changed by `ai bb`. Provider
credentials and authentication remain local. Installing the provider plugin
does not install or authenticate the Devin executable.

## Instructions and skills

`instructions` is applied through
`bb plugin config custom-instructions set instructions <text>`. This replaces
that plugin's instruction value. The plan shows both values first. It does
not change `<dataDir>/AGENTS.md`, the workspace `AGENTS.md`, or native agent
instructions. The built-in Custom instructions plugin must already be
installed; if it is absent, install `builtin:custom-instructions` with BB and
make a new plan. Instructions take effect when BB supplies task instructions
to a provider session.

Keep common agent skills in the existing shared skill tree. `ai bb` does not
copy that tree to BB. BB's public `skill install` command installs registry
identities; it does not create arbitrary local user skills from this tree.
For BB-specific project skills, use the documented
`.bb/skills/<name>/SKILL.md` project surface. For a registry skill, inspect
`bb skill registry detail <registry-skill-id>` before an explicit
`bb skill install <registry-skill-id>`. This PR creates no duplicate skill set.

## State boundaries and failures

Never track `~/.bb/config.json`, `env.json`, credentials, database files,
conversations, caches, machine IDs, or generated plugin bundles. The BB
config file can contain `machineCredential`. This command never reads it.
It reads only selected values from public BB responses. It does not edit a
BB database or write into the BB data directory. It does not export arbitrary
plugin settings, custom model definitions, environment values, keyboard
shortcuts, or theme files. Use the relevant public BB command for those
settings where available; no unsupported write is inferred.

Apply uses a lock in `AI_CONFIG_STATE_HOME`, or
`~/.local/state/ai-config/bb-apply.lock`. It prevents concurrent runs that use
the same state directory. It does not lock BB's UI or other clients. Do not
edit selected settings during apply. BB does not offer an atomic transaction
across these commands. If a command fails, earlier changes can remain. Fix
the cause, review a new plan, then apply its token. A normal repeat run does
not repeat completed operations. After a killed process, check that no
apply process is running before removing a stale lock.

## Validation and Linux use

```sh
cd .config/ai-config
npm ci
npm test
```

The BB tests run a separate fake BB executable in a temporary directory. They
check preservation of unmanaged settings and plugins, stale previews, source
conflicts, repeat runs, failures, and malformed input. They do not call the
live BB server. The separate BB workflow runs these tests on Ubuntu with
Node.js 18 and 22. A passing fake-CLI test is not proof of a live Linux BB
installation. On the future server, install BB and its prerequisites, sign
in to providers and private Git as needed, then run the preview and explicit
apply commands above. Check `bb plugin list` for plugin runtime errors.

This change does not depend on the Linux bootstrap PR #5. It changes no
bootstrap script and runs directly from a checkout. No global installation,
home sync, or live BB apply is part of its tests.
