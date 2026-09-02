---
name: ai-agents
description: Use when the user explicitly asks to delegate a task through a specific installed AI CLI such as `codex`, `claude`, `agent`, `opencode`, or `gemini`. Provides a short command reference for running that harness headlessly, in read-only mode, or in an isolated worktree.
metadata:
  argument-hint: <cli-and-task>
---

# AI Agents

Use this skill only when the user names the CLI they want.

- Keep delegated tasks bounded.
- Run from the correct repository or working directory.
- Prefer headless commands that print and exit.
- If the user asks for Codex subagents, use Codex.
- If you are launching a subagent inside the same harness you are already using, use that harness's native subagent feature instead of shelling out to its CLI.
- Review delegated output yourself before trusting it.

Example: if you are already operating inside a harness and need a subagent of that same harness, use the native subagent feature instead of launching the CLI recursively from the shell.

## Scope The Request

Include these pieces in the delegated prompt:

- Role: review, summarize, plan, or implement
- Scope: exact files, directories, or question
- Constraints: no edits, no network, no tests, or JSON-only output when needed
- Return contract: bullets, JSON, diff summary, or exact phrase

Good default:

```text
<role>. Scope: <files or question>. Constraints: <no edits / no network / JSON output>. Return: <output contract>.
```

## Quick Reference

### Codex

Use Codex when the user asks for Codex specifically.

```bash
codex exec '<task>'
codex exec --sandbox read-only '<task>'
codex exec --json '<task>'
codex exec -C /path/to/repo '<task>'
codex exec --output-schema schema.json '<task>'
```

- `exec`: headless execution
- `--sandbox read-only`: planning or read-only runs
- `--json`: stream structured events
- `-C`: run against a specific directory
- `--output-schema`: constrain the final response shape

### Claude

```bash
claude -p '<task>'
claude -p --permission-mode plan '<task>'
claude -p -w task-name '<task>'
claude -p --output-format json --json-schema '{...}' '<task>'
```

- `-p`: print and exit
- `--permission-mode plan`: read-only/planning mode
- `-w`: create a git worktree

### Agent

```bash
agent -p --trust '<task>'
agent -p --mode ask --trust '<task>'
agent -p --mode plan --trust '<task>'
agent -p -w task-name --trust '<task>'
agent -p --output-format json --mode ask --trust '<task>'
```

- `-p`: print and exit
- `--mode ask|plan`: read-only modes
- `-w`: create an isolated worktree
- `--trust`: trust the current workspace in headless mode

### Opencode

```bash
opencode run '<task>'
opencode run --format json '<task>'
opencode run --dir /path/to/repo '<task>'
opencode run -m <provider>/<model> --dir /path/to/repo '<task>'
opencode run --fork -s <session-id> '<task>'
```

- `run`: headless execution
- `--format json`: raw JSON events
- `--dir`: run against a specific directory
- `-m`, `--model`: pin the delegated run to a specific provider/model
- `--fork`: continue from a session without mutating the original

Use `opencode models` or `opencode models <provider>` to confirm the exact
provider/model id before delegating to a newly added model. For frontend-heavy
tasks, a cost-effective frontend model such as GLM 5.2 can be a good Opencode
delegate once its provider id is configured locally.

### Gemini

```bash
gemini -p '<task>' --output-format text
gemini -p '<task>' --output-format json
gemini -p '<task>' --approval-mode auto_edit
gemini -p '<task>' --approval-mode yolo
gemini -p '<task>' --resume latest
```

- `-p`: headless prompt
- `--output-format`: `text`, `json`, or `stream-json`
- `--approval-mode auto_edit|yolo`: loosen confirmations when needed
- `--resume latest`: continue the latest session
