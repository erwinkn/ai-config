---
name: codex-implementation
description: Delegate coding work to gpt-5.5 through the Codex CLI (`codex exec`). Use for bulk or mechanical implementation with a clear spec, migrations, data analysis, investigation/diagnosis, or a second independent implementation pass — any task the model rankings route to gpt-5.5.
metadata:
  argument-hint: <task to delegate>
---

# Codex Implementation

Run gpt-5.5 headlessly via `codex exec`. The user's `~/.codex/config.toml` already defaults to gpt-5.5 at xhigh reasoning effort, so don't pass `-m` or effort overrides unless you have a reason.

## Command

```bash
codex exec -s workspace-write -C /path/to/repo -o /tmp/codex-last.md - <<'PROMPT'
<task>
...self-contained prompt...
</task>
PROMPT
```

- Always pass the prompt via stdin heredoc (`-`) for anything longer than one line — no shell-quoting hazards.
- Always pass an explicit `--sandbox`: `read-only` for investigation/analysis, `workspace-write` for implementation. Never rely on the config default (it is `danger-full-access`).
- `-C <dir>`: run against the target repo; `--add-dir <dir>` for extra writable dirs.
- `-o <file>`: writes the final message to a file — read that instead of scraping stdout.
- `--output-schema <schema.json>`: force a JSON final answer when you need structured output.
- `--ephemeral`: throwaway runs you'll never resume (quick analysis, one-off questions).
- Stderr noise about ignored config keys or MCP transport errors is normal; judge the run by its final message and the diff.

## Execution

- One clear task per run. Split unrelated asks into separate runs.
- Runs take minutes at xhigh effort. Use the Bash tool's `run_in_background` for anything non-trivial and check back; foreground only for small, fast asks.
- Follow-ups on the same thread: `codex exec resume --last '<delta instruction>'` (or `resume <session-id>`). Send only the delta, not the whole prompt again.
- For parallel Codex runs against the same repo, isolate each in its own git worktree first — Codex has no worktree flag of its own.

## Prompt contract

Codex gets no conversation context — the prompt must stand alone. Write it like an operator: compact, block-structured with XML tags.

- `<task>`: the concrete job, relevant paths/context, and what done looks like. Never assume it will infer the end state.
- `<output_contract>`: exact shape of the final message (e.g. "summary of changes as a bullet list, files touched, how you verified").
- `<follow_through>`: "Default to the most reasonable low-risk interpretation and keep going; only stop if a missing detail changes correctness or safety." Headless runs can't ask questions — without this it may stop early.
- `<verification>`: for implementation, require it to run the relevant tests/build/typecheck before finishing and to fix failures rather than reporting them.
- `<scope>`: for write runs, "Only touch what the task requires. No unrelated refactors, no dependency changes unless asked."

## After the run

- Read the final message, then review the actual diff yourself (`git -C <repo> diff`) before accepting. Judge the output, not the model: if it doesn't meet the bar, iterate via `resume` or redo with a smarter model per the model-picking rules.
- Report results to the user with the diff summary, not just Codex's self-report.

## Inside workflows and subagents

The Agent/Workflow `model` parameter only takes Claude models. To fan out gpt-5.5 work, spawn a thin wrapper: a Claude agent with `model: 'sonnet', effort: 'low'` whose prompt says to compose a self-contained codex prompt per this skill, run `codex exec` via Bash, and return the final message verbatim without doing any work itself.
