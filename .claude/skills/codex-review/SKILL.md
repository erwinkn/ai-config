---
name: codex-review
description: Run a gpt-5.5 code review through the Codex CLI (`codex review`). Use when the user asks for a Codex review, or as an extra independent perspective on a diff, branch, or commit alongside Claude-side review.
metadata:
  argument-hint: "[--base <ref> | --uncommitted | --commit <sha>] [focus]"
---

# Codex Review

`codex review` runs a non-interactive gpt-5.5 review with Codex's built-in review harness and prints findings to stdout. It reviews git state, not files you pass — run it from the target repo root.

## Scope selection

```bash
codex review --uncommitted            # staged + unstaged + untracked
codex review --base main              # branch diff vs merge-base with main
codex review --commit <sha>           # a single commit
```

Pick the scope from what the user asked to review. Before running, sanity-check there is something to review (`git status --short`, `git diff --shortstat <base>...HEAD`) — untracked files count as reviewable work.

## Custom instructions

The positional prompt argument adds review instructions on top of the built-in contract:

```bash
codex review --base main 'Focus on concurrency and error handling in the queue worker.'
```

For an adversarial pass, frame it as a challenge review rather than a stricter bug hunt:

```bash
codex review --base main 'Challenge the implementation approach itself: question the design choices, tradeoffs, and assumptions, not just line-level defects. Ground every claim in the diff or surrounding code.'
```

## Execution

- Reviews of non-trivial diffs take minutes. Run via the Bash tool with `run_in_background` and collect output when done; foreground only for 1–2 file diffs.
- Review is read-only by design: do not fix findings as part of the same delegation, and don't let the review run mutate anything.
- Stderr noise about ignored config keys or MCP transport errors is normal.

## Handling results

- Relay Codex's findings faithfully — don't silently drop ones you disagree with.
- Verify findings against the actual code before acting on them; treat gpt-5.5 as one independent perspective, not ground truth. Per the model-picking rules, primary reviews belong to fable-5/opus-4.8, with Codex as the extra voice.
- Only apply fixes when the user asked for review-and-fix; otherwise report.

## Inside workflows and subagents

To include a Codex review as one voice in a multi-agent review, spawn a thin wrapper: a Claude agent with `model: 'sonnet', effort: 'low'` whose prompt says to run the appropriate `codex review` command via Bash from the repo root and return its output verbatim, adding no findings of its own.
