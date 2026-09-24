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

The reviewer defaults to a model from another family than yours, so the review is an independent voice:

| You are | Reviewer | BB spawn flags |
| --- | --- | --- |
| Claude | GPT-6 Astra, extra high reasoning | `--provider codex --model gpt-6-astra --reasoning-level xhigh` |
| any other model | Claude Fable 5.1, high reasoning | `--provider claude-code --model claude-fable-5-1 --reasoning-level high` |

A model the user names overrides the default.

## Choose where the review runs

Review in this thread only when all three conditions hold:

1. You run on the review model.
2. The thread is fresh: an early turn with little context.
3. The checkout is clean: `git status --porcelain` lists no changes to tracked files.

Otherwise, spawn a subagent with a fresh context in the same environment. The child runs the review and returns the handoff. The child must not spawn further subagents.

In BB threads, spawn, wait, and collect:

```sh
bb thread spawn --json --project "$BB_PROJECT_ID" --environment "$BB_ENVIRONMENT_ID" \
  --parent-self --title "Code review" <model flags> --prompt "<prompt>"
bb thread wait <child-id> --timeout 1200
bb thread output <child-id>
```

In other harnesses, run the review through a CLI with a fresh context: `codex exec -s read-only -m gpt-6-astra -c model_reasoning_effort=xhigh "<prompt>"` or `claude -p --model claude-fable-5-1 --effort high "<prompt>"`.

Do not edit files or switch branches while a child runs. It shares your checkout.

When you are the spawned review subagent, skip this routing. Go directly to [references/review.md](references/review.md).

## Review in this thread

Read [references/review.md](references/review.md) and follow it. Return the handoff defined there.

## Spawn the review subagent

Tell the child:

"You are the code review subagent. Review <target>. Use the code-review skill and follow references/review.md inside it. Return the handoff from that file. Do not edit code. Do not spawn another subagent."

`<target>` names the mode and the ref, for example `the uncommitted changes`, `the current branch against main`, or `PR 123`.

For a thermo-nuclear review, add: "This is a thermo-nuclear review."

When the branch has a decision log, add: "The author's decision log is at <path>. A logged decision is deliberate, not automatically right. Flag it when it is wrong, and look hardest at rows with low confidence." To find the log, run the `decision-audit` skill's `scripts/decision-log.sh path` in the repository.

Run the child on the review model. Return the child's report to the user. Do not summarize it and do not add findings of your own.

## Split very large changes

One reviewer loses depth on a very large change. Split the review by domain when the change has more than about 2,000 changed lines, or spans subsystems that a reviewer would read separately, for example a server, a web client, and a database migration.

1. Size the change with `git diff --shortstat <base>` and group the changed paths into domains.
2. Spawn one review subagent per domain, all at once, on the review model. Add to the prompt: "Review only <paths>. Other reviewers cover <other domains>. Flag problems where your paths meet theirs."
3. Return every handoff under a heading that names its domain. The overall verdict is `needs attention` when any child says so.
