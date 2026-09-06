# Installation upgrades

The installation layout has its own integer version. It is separate from Git
commits and skill package versions. The local marker is
`~/.local/state/ai-config/install-version`. No marker means version 0. The
current version is 1. The repository declares its required version in
`.config/ai/install-version`. Setup rejects invalid or newer local versions.
`ai sync` checks the fetched upstream version before checkout and stops if it
requires a different installer. It applies the exact commit that passed this
check. `ai sync` takes no arguments; use `ai git` for custom Git operations.

## Upgrade from version 0

Use an updated, separate source checkout. Do not start this first upgrade with
an old installed `ai sync`: that command does not know about installation
versions or the directory move.

```sh
git clone https://github.com/erwinkn/ai-config.git ~/Code/ai-config-upgrade
cd ~/Code/ai-config-upgrade
.config/ai/bin/setup-unix
```

The same entry point supports macOS and Linux. On Windows, run
`.config/ai/scripts/setup-windows-ai.ps1` from the updated checkout.

Setup performs these steps before it writes version 1:

1. Lock the installation and back up version 0 data.
2. Copy local settings from `.config/ai-config/local` to `.config/ai/local`.
   This includes BB settings and explicit Claude and Codex pins.
3. Copy configuration snapshots to `.local/state/ai` so capture can distinguish
   direct edits from existing values.
4. Update the home Git checkout. Transfer skill changes and deletions from the
   old two scopes to the tracked `.agents/skills` tree. Unchanged skills take
   the new tracked version. Conflicting edits between scopes stop the upgrade.
5. Restore skill edits, install dependencies, update the Unix `ai` symlink or
   Windows profile snippet, and capture active configuration changes.
6. Write the version marker atomically, after setup succeeds.

An existing destination file with different local settings stops the migration.
Resolve that conflict before retrying. Setup does not merge or discard one
version silently. Modified tracked files outside the old skill trees can also
stop Git's fast-forward update; resolve those changes before retrying.

## Recovery

The backup and progress record stay at
`~/.local/state/ai-config/migration-0-to-1`. They can contain private settings.
Do not commit them. Keep them until you have checked the upgraded installation.
The old local settings also remain in place; setup does not delete that source.

If setup fails, run the same setup command again. It resumes from the progress
record and does not write version 1 until the final steps succeed. Do not edit
installation files during an incomplete upgrade. Old skill trees may be absent
between backup and restoration. Their saved copies remain in the migration
backup. A later run recovers a lock whose owner process has exited.

Fresh installations follow the same version protocol without a legacy data
migration. Normal `ai` commands reject a detected pending upgrade. Explicit
`AI_CONFIG_HOME` configurations are independent of the default installation.

## Future versions

Add one explicit migration for each layout change. Keep the marker path stable.
Each migration must have a preflight check, a durable backup and progress record,
and tests for retry after failure. Never advance the version before verification
succeeds. The current installer supports only `0 → 1`; a future layout requires
a new installer.
