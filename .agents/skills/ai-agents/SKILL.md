---
name: ai-agents
description: Use when the user explicitly asks to delegate a task through a specific installed AI CLI such as `claude`, `agent`, `opencode`, or `gemini`. Provides a short command reference for running that harness headlessly, in read-only mode, or in an isolated worktree.
metadata:
  argument-hint: <cli-and-task>
---

# AI Agents

Use this skill only when the user names the CLI they want.

- Keep delegated tasks bounded.
- Run from the correct repository or working directory.
- Prefer headless commands that print and exit.
- Review delegated output yourself before trusting it.

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
opencode run --fork -s <session-id> '<task>'
```

- `run`: headless execution
- `--format json`: raw JSON events
- `--dir`: run against a specific directory
- `--fork`: continue from a session without mutating the original

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
