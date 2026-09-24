---
name: autoreview
description: Review a change, fix the findings at their root cause, and repeat until a review round comes back clean. Use when the user asks for an autoreview, or to review and fix a change until it is clean.
metadata:
  argument-hint: "[uncommitted | branch <ref> | commit <sha> | pr <ref>]"
---

# Autoreview

Run review rounds on a change and fix what they find, until a round comes back clean. Each round has four steps: review, triage, gate, fix.

Pick the target as the `code-review` skill does. Keep a ledger across rounds: each finding, its root cause, and what you did with it.

## 1. Review

Run the `code-review` skill on the target. It picks the reviewer model, and it splits very large changes across reviewers by domain.

From round 2 on:

- Review the whole change again, fixes included, with a fresh reviewer. A fix can break code that the last round passed, and a new reviewer finds different things.
- For a `pr` or `commit` target, switch to `branch` mode against the PR base or the commit's parent. The first mode would miss the uncommitted fixes.
- Give the reviewer the findings you rejected in earlier rounds, each with its reason, as extra instructions: "These were considered and rejected. Raise them again only with new evidence."

## 2. Triage

1. **Verify.** Check each finding against the code. Reject the ones you can disprove, and note why. Do not fix a finding only because a reviewer raised it.
2. **Group by root cause.** Several findings often share one cause. Example: "stale total after edit", "double charge on retry", and "race in checkout" can all come from a cart total that is cached in three places instead of derived from the line items. That is one group, not three fixes.
3. **Design the right fix for each group.** Ask: if we wrote this from scratch, with full knowledge of this problem, what would we build? The answer can be a redesign, a refactor, or a patch. A patch is right when the design is sound and the code has a local slip. A redesign is right when the design makes this class of bug easy to write. In the example above, the right fix derives the total from the line items, and the three findings go away with it. The `principles` skill covers this: Fix Root Causes, Redesign from First Principles, and Attack the Premise.

## 3. Gate

Stop and bring the decision to the user when the right fix for any group needs a major design decision or goes against a main assumption of the work. Signs:

- It changes a public API, a data model, a storage format, or a contract that other systems use.
- It goes against the plan, the architecture the user agreed to, or an assumption the user stated.
- It changes behavior that users see, in a way the request did not ask for.
- A reasonable engineer could pick a different option, and the options have real tradeoffs.

Do not edit code for this round. Give the user the problem with a concrete example, the options with their tradeoffs, and your recommendation. Include the triage of the other groups, so the user sees the full round. Continue when the user decides.

## 4. Fix

Fix one group at a time. Verify each fix with the narrowest check that proves it: the relevant tests, a type check, or a reproduction. Then start the next round.

## Stop

Stop the loop in one of these cases.

**The round is clean.** No P0, P1, or P2 finding survives triage. P3 findings alone do not start a new round; list them in the report.

**The fixes cause more problems than they solve.** Signs:

- New findings point at code that your fixes wrote.
- The same area or the same kind of finding comes back round after round.
- The count of surviving findings does not go down across two rounds.
- Fixes go back and forth, for example A to B and back to A.
- Round 5 is not clean.

Churn usually means the root cause is above the code you are fixing: a design flaw or a wrong assumption. Do not start another round. Tell the user the pattern you saw and what you think the real cause is.

## Report

End with a short report:

- The number of rounds and why the loop stopped.
- Each root cause with the fix you chose (redesign, refactor, or patch) and the findings it closed.
- Rejected findings with their reasons.
- Open P3 findings.
- Decisions that are waiting for the user.
