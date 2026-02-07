---
name: tuistory
description: Canonical skill for TUI automation and testing with tuistory CLI + TypeScript API. Use tmux only as a manual fallback for visual debugging.
allowed-tools: Bash, Write, Read
---

# tuistory - Canonical TUI Automation

Automate and test terminal apps with `tuistory` (CLI and TypeScript API).

`tuistory` is the default path for agent-driven TUI testing/debugging.
Use `tmux` only as a manual fallback when you need to visually attach to a running terminal session or when `tuistory` cannot run in the environment.

## Prerequisites

- For CLI usage: Node/npm available, run via `npx -y tuistory@0.0.12 ...`
- For TypeScript API usage: Bun recommended for quick scripts, or a Node TS setup

## Canonical Workflow (CLI)

1. Start session: `npx -y tuistory@0.0.12 launch "<command>" -s <session>`
2. Wait for ready text: `npx -y tuistory@0.0.12 wait "<pattern>" -s <session>`
3. Interact: `type`, `press`, `click`, `scroll`, `resize`
4. Assert state: `snapshot --json --trim -s <session>`
5. Close session: `npx -y tuistory@0.0.12 close -s <session>`

## Quick Start

```bash
SESSION="tui-test-$$"
npx -y tuistory@0.0.12 launch "my-cli --interactive" -s "$SESSION" --timeout 10000
npx -y tuistory@0.0.12 wait "Main Menu" -s "$SESSION" --timeout 10000
npx -y tuistory@0.0.12 press down down enter -s "$SESSION"
npx -y tuistory@0.0.12 wait "/success|saved/i" -s "$SESSION" --timeout 5000
npx -y tuistory@0.0.12 snapshot -s "$SESSION" --json --trim
npx -y tuistory@0.0.12 close -s "$SESSION"
```

## CLI Reference

### Session lifecycle

`launch <command>`
- Launch a terminal session.
- Options:
- `-s, --session <name>` (default: `default`)
- `--cols <n>` (default: `80`)
- `--rows <n>` (default: `24`)
- `--cwd <path>`
- `--env <key=value>` (repeatable)
- `--no-wait` (skip initial data wait)
- `--timeout <ms>` (default: `5000`)

`sessions`
- List active sessions.

`close`
- Close a specific session.
- Required: `-s, --session <name>`

`logfile`
- Print relay daemon log file path.

`daemon-stop`
- Stop relay daemon if needed for recovery.

### State inspection and synchronization

`snapshot`
- Read current terminal text.
- Required: `-s, --session <name>`
- Options:
- `--json` (machine-readable `{ text, session }`)
- `--trim` (trim trailing empty/whitespace lines)
- `--immediate` (skip idle wait)
- `--bold`, `--italic`, `--underline`
- `--fg <color>`, `--bg <color>`
- `--no-cursor` (hide cursor marker)

`wait <pattern>`
- Wait for text/pattern to appear.
- Required: `-s, --session <name>`
- Option: `--timeout <ms>` (default: `5000`)

`wait-idle`
- Wait until terminal output is idle.
- Required: `-s, --session <name>`
- Option: `--timeout <ms>` (default: `500`)

### Input and interactions

`type <text>`
- Type text character-by-character.
- Required: `-s, --session <name>`

`press <key> [...keys]`
- Press one or more keys in order.
- Required: `-s, --session <name>`
- Supports letters, digits, punctuation, and special keys/modifiers.
- Common keys: `enter`, `esc`, `tab`, `space`, `backspace`, `delete`, `up`, `down`, `left`, `right`, `home`, `end`, `pageup`, `pagedown`, `f1..f12`
- Modifiers: `ctrl`, `alt`, `shift`, `meta`

`click <pattern>`
- Click text matching a pattern.
- Required: `-s, --session <name>`
- Options: `--first`, `--timeout <ms>`

`click-at <x> <y>`
- Click by coordinates.
- Required: `-s, --session <name>`

`scroll <direction> [lines]`
- Scroll terminal with mouse wheel events.
- Required: `-s, --session <name>`
- Direction: `up` or `down`
- Optional: `--x <n> --y <n>` to target coordinates

`resize <cols> <rows>`
- Resize terminal dimensions.
- Required: `-s, --session <name>`

`capture-frames <key> [...keys]`
- Capture multiple text frames after keypresses for transition/layout debugging.
- Required: `-s, --session <name>`
- Options: `--count <n>` (default: `5`), `--interval <ms>` (default: `10`)

### Pattern format

- `wait` and `click` accept plain text or regex-like syntax:
- Plain text: `"Saved successfully"`
- Regex syntax: `"/error|success/i"`

## TypeScript API Reference

### Import and launch

```typescript
import { launchTerminal } from 'tuistory';

const session = await launchTerminal({
  command: 'my-cli',
  args: ['--interactive'],
  cols: 120,
  rows: 40,
  cwd: process.cwd(),
  env: { CI: '1' },
  showCursor: false,
  waitForData: true,
  waitForDataTimeout: 5000,
});
```

`launchTerminal(options)` fields:
- `command: string`
- `args?: string[]`
- `cols?: number` (default `80`)
- `rows?: number` (default `24`)
- `cwd?: string`
- `env?: Record<string, string | undefined>`
- `showCursor?: boolean`
- `waitForData?: boolean`
- `waitForDataTimeout?: number`

### Session methods

- `waitForData({ timeout? })`
- `waitIdle({ timeout? })`
- `type(text)`
- `press(keyOrKeys)`
- `text(options?)`
- `waitForText(pattern, { timeout? })`
- `captureFrames(keys, { frameCount?, intervalMs? })`
- `click(pattern, { timeout?, first? })`
- `clickAt(x, y)`
- `scrollUp(lines?, x?, y?)`
- `scrollDown(lines?, x?, y?)`
- `resize({ cols, rows })`
- `close()`

Advanced methods (usually not needed): `writeRaw(data)`, `sendKey(keys)`.

### `text(options?)` shape

```typescript
const all = await session.text();
const trimmed = await session.text({ trimEnd: true });
const fast = await session.text({ immediate: true });
const boldOnly = await session.text({ only: { bold: true } });
const redOnly = await session.text({ only: { foreground: 'red' } });
```

### Library example

```typescript
import { launchTerminal } from 'tuistory';

const s = await launchTerminal({ command: 'my-interactive-cli' });
try {
  await s.waitForText('Main Menu', { timeout: 5000 });
  await s.press(['down', 'down', 'enter']);
  await s.waitForText(/settings/i, { timeout: 3000 });
  await s.type('new-value');
  await s.press('enter');
  await s.waitForText('Saved', { timeout: 3000 });
  console.log(await s.text({ trimEnd: true }));
} finally {
  s.close();
}
```

## Reliability Guidelines

- Prefer `wait`/`waitForText` and `wait-idle` over `sleep`.
- Use unique session names (`test-$$`) in scripts.
- Always close sessions in cleanup paths.
- Use `snapshot --json` (CLI) or `text()` (API) for assertions.
- Use `capture-frames` when debugging flicker/transition states.
- If commands fail unexpectedly, check `logfile` and run `daemon-stop`.

## Manual tmux Fallback (Not Canonical)

Use `tmux` only when you need manual visual inspection:

```bash
SESSION="manual-debug-$$"
tmux new-session -d -s "$SESSION"
tmux send-keys -t "$SESSION" "my-cli --interactive" Enter
tmux attach -t "$SESSION"
# Detach with Ctrl+b then d
# When done:
tmux kill-session -t "$SESSION"
```

Do not default to tmux for automated tests; use `tuistory` first.
