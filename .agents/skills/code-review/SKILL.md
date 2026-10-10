---
name: code-review
description: Review code changes and return a prioritized handoff. Use when the user asks to review a diff, branch, commit, PR, or folder, including a thermo-nuclear (extremely strict code quality) review.
metadata:
  argument-hint: "[uncommitted | branch <ref> | commit <sha> | pr <ref> | folder <path>...]"
---

# Code review

Review a change made by another engineer and return a prioritized handoff. Do not edit code.

The full review instructions live in [references/review.md](references/review.md).

## Pick the review model

Default to a reviewer from another model family than yours, so the review is an independent voice. For example, Claude asks a GPT model (through Codex), and a GPT model asks Claude. Use a high reasoning level when the reviewer has one. When no other family is available, use your own model with a fresh context.

A model the user names overrides the default.

## Choose where the review runs

Review in this conversation only when all three conditions hold:

1. You run on the review model.
2. The conversation is fresh: an early turn with little context.
3. The checkout is clean: `git status --porcelain` lists no changes to tracked files.

Otherwise, start a reviewer with a fresh context on the same checkout through your environment's usual way of starting another agent: a subagent or a new session. If someone else dispatches agents for you, ask them for the reviewer. The reviewer runs the review and returns the handoff. It must not start further reviewers.

Do not edit files or switch branches while a reviewer runs. It shares your checkout.

When you are the reviewer, skip this routing. Go directly to [references/review.md](references/review.md).

## Review in this conversation

Read [references/review.md](references/review.md) and follow it. Return the handoff defined there.

## Start a reviewer

Tell the reviewer:

"You are the code reviewer. Review <target>. Use the code-review skill and follow references/review.md inside it. Return the handoff from that file. Do not edit code. Do not start another reviewer."

`<target>` names the mode and the ref, for example `the uncommitted changes`, `the current branch against main`, or `PR 123`.

For a thermo-nuclear review, add: "This is a thermo-nuclear review."

When the branch has a decision log, add: "The author's decision log is at <path>. A logged decision is deliberate, not automatically right. Flag it when it is wrong, and look hardest at rows with low confidence." To find the log, run the `decision-audit` skill's `scripts/decision-log.sh path` in the repository.

Return the reviewer's report to the user. Do not summarize it and do not add findings of your own.

## Split very large changes

One reviewer loses depth on a very large change. Split the review by domain when the change has more than about 2,000 changed lines, or spans subsystems that a reviewer would read separately, for example a server, a web client, and a database migration.

1. Size the change with `git diff --shortstat <base>` and group the changed paths into domains.
2. Start one reviewer per domain on the review model, in parallel when your tool allows it. Add to the prompt: "Review only <paths>. Other reviewers cover <other domains>. Flag problems where your paths meet theirs."
3. Return every handoff under a heading that names its domain. The overall verdict is `needs attention` when any reviewer says so.
