---
name: handoff
description: "Write a path-free, clipboard-ready handoff prompt that lets another agent investigate, discuss, or pick up a specific task."
---

# Handoff

Write a clipboard-ready prompt for another agent to investigate, discuss, or work
on a specific task.

Use when the user asks for `handoff <task>`, "write a handoff", "delegate this",
or wants a prompt for another agent.

## Workflow

1. Identify the task and the next session's focus from the user text. If the user
   gives only a short label, infer from the current repo, recent discussion,
   branch name, linked issue/PR, docs, and obvious nearby context.
2. Gather enough context to write a useful handoff: repo/product identity,
   relevant issue/PR/branch names, likely modules, constraints, and known
   symptoms. Do not perform the receiving agent's full independent review or
   decide the final technical direction for them.
3. Find existing artifacts that already carry detail: issues, PRs, commits,
   specs, plans, ADRs, test output, or saved reports. Point to them with portable
   anchors instead of duplicating their contents.
4. Write a standalone prompt for a fresh agent. Include only relevant skills
   that are actually available to the receiving agent.
5. Redact credentials, tokens, private keys, passwords, and personal information
   that the receiving agent does not need.
6. Save the prompt in the operating system's temporary directory, then copy the
   full prompt to the clipboard.
7. Final reply: terse confirmation with the task title. Do not paste the full
   prompt unless the user asks or clipboard copy is unavailable.

## Handoff Prompt Rules

The prompt must:

- Start a discussion, not a command-only work order.
- Ask the receiving agent to do an extensive independent review before changing
  anything.
- Make clear that the receiving agent owns that review; the handoff only gives
  starting context and known constraints.
- Ask the agent to decide whether the task is a good idea, stale, already
  solved, over-scoped, or better handled differently.
- Assume the agent starts in the repo, a parent directory, a workspace directory,
  or a home directory and can find the repo itself.
- Avoid filesystem paths. No absolute paths, home-directory paths, checkout
  names, or repo-relative file paths unless the user explicitly requests them.
- Use portable anchors instead: repo owner/name, product/module names, issue/PR
  URLs, branch names, package/plugin names, public symbols, command names, config
  keys, exact error text, docs titles, and search terms.
- Reference existing artifacts instead of reproducing long plans, specs, diffs,
  logs, or decisions already recorded elsewhere.
- Include enough context for the receiving agent to get the right repo, boundary,
  and desired outcome.
- Include constraints, non-goals, validation expectations, and the desired
  output shape.
- Tailor the task, context, and suggested skills to the user's stated focus for
  the next session.
- Include a `Suggested skills` section only when one or more relevant skills are
  known to be available. Give one short reason for each suggestion; never invent
  a skill or silently make it a prerequisite.
- Tell the receiving agent to re-check live repo/GitHub/CI state where relevant.
- Tell the receiving agent not to push, merge, close issues/PRs, label, or post
  public comments unless the handoff explicitly asks for it.
- Exclude secrets and personal data that are not required to continue the task.

## Prompt Template

Use this shape by default:

```text
I want to discuss and possibly work on: <short task title>

Context:
- <portable repo/product context>
- <what triggered this task>
- <known current state, branch/issue/PR names or URLs if relevant>
- <important constraints and ownership boundaries>
- <portable references to existing artifacts rather than repeated content>

Before doing any implementation:
- Find the right repository from the current directory, a parent directory, or the usual workspace.
- Read the local agent/repo instructions.
- Inspect the relevant code, docs, tests, recent commits, and linked issue/PR state.
- Decide whether this task is still real, whether the proposed direction is a good idea, and whether a smaller/better fix exists.
- Call out stale assumptions, hidden risks, and anything that should stop the work.

Task:
- <what to investigate or implement if the review supports it>
- <expected behavior or decision criteria>
- <non-goals>

Validation:
- <focused tests/checks/live proof expected>
- <what evidence should be included>
- <what is explicitly not required>

Suggested skills:
- <$skill-name — why it helps; omit this section when no relevant installed skill is known>

Output:
- Start with your review findings and recommendation.
- Then give the proposed plan or patch summary.
- If you edit code, keep changes scoped and report exact proof run.
- Do not push, merge, close issues/PRs, label, or post public comments unless explicitly told.
```

## Clipboard

Create a securely named file in the operating system's temporary directory and
write the prompt there before copying it. On macOS, for example:

```sh
handoff_prompt_file="$(mktemp -t handoff-prompt)"
chmod 600 "$handoff_prompt_file"
pbcopy < "$handoff_prompt_file"
```

Write the prompt with a safe file-editing mechanism before running `pbcopy`.
Avoid inline shell quoting for prompts containing backticks, `$`, quotes, or
user text. Keep the temporary file until delivery is confirmed so the prompt is
recoverable if clipboard transfer fails.

If `pbcopy` is unavailable, use the obvious platform clipboard tool (`wl-copy`,
`xclip`, `clip.exe`). If no clipboard tool succeeds, print the prompt and say
clipboard copy was unavailable.

## Quality Bar

- No invented facts. Mark reviewed facts as such only after checking them.
- No secrets or unnecessary personal information.
- No path leakage. Rewrite any accidental path as a symbol, module, command,
  issue/PR URL, or search term.
- No duplicated artifact content when a portable pointer will let the receiving
  agent recover it.
- Enough context for a fresh agent to orient; no giant brain dump.
- First real instruction to the receiving agent: review, discuss, assess.
