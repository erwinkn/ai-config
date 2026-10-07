---
name: autoreview
description: Review a change, fix the findings at their root cause, and repeat until a review round comes back clean. Use when the user asks for an autoreview, or to review and fix a change until it is clean.
metadata:
  argument-hint: "[uncommitted | branch <ref> | commit <sha> | pr <ref>]"
---

# Autoreview

Run review rounds on a change and fix what they find, until a round comes back clean. Each round has four steps: review, triage, gate, fix.

Pick the target as the `code-review` skill does. Log each root-cause fix and each rejected finding with the `decision-audit` skill, as you decide it.

## Scope

The scope is the change as it stood before round 1, and the request or plan behind it. Scope creep is a hard no. The loop fixes what the change got wrong, not everything the reviewers notice.

A finding is in scope when the change caused it: it sits in code the original change wrote, or in code a fix from this loop wrote. A real bug or design problem that existed before the change is out of scope, even when it sits next to changed code. Do not fix it. Escalate it to the user, or file it as an issue or ticket if the repo's instructions say where these go.

Example: the change adds a discount code to checkout. The reviewer flags that the discount is lost on payment retry, and that `CartStore` never clears expired carts. The first is in scope, because the change wrote the discount code. The second was true before the change. Fix the first and escalate the second.

A fix may reach into code outside the change when the root cause of an in-scope finding lives there. If that fix redesigns code the change did not touch, take it through the gate.

## 1. Review

Run the `code-review` skill on the target. It picks the reviewer model, and it splits very large changes across reviewers by domain. When the user asks for a thermo-nuclear autoreview, every round is a thermo-nuclear review.

From round 2 on:

- Review the whole change again with a fresh reviewer, and point it at the last round's fixes as the focus. It reads those fixes alongside the rest of the change, because a fix can break code that the last round passed. A fresh reviewer also finds different things in code it has already seen.
- For a `pr` or `commit` target, switch to `branch` mode against the PR base or the commit's parent. The first mode would miss the uncommitted fixes.
- Give the reviewer the findings you rejected in earlier rounds, each with its reason from the decision log, as extra instructions: "These were considered and rejected. Raise them again only with new evidence."

## 2. Triage

1. **Verify.** Check each finding against the code. Reject the ones you can disprove, and note why. Do not fix a finding only because a reviewer raised it.
2. **Check scope.** Set out-of-scope findings aside to escalate or file, as described in Scope.
3. **Group by root cause.** Several findings often share one cause. Example: "stale total after edit", "double charge on retry", and "race in checkout" can all come from a cart total that is cached in three places instead of derived from the line items. That is one group, not three fixes.
4. **Design the right fix for each group.** Ask: if we wrote this from scratch, with full knowledge of this problem, what would we build? The answer can be a redesign, a refactor, or a patch. A patch is right when the design is sound and the code has a local slip. A redesign is right when the design makes this class of bug easy to write. In the example above, the right fix derives the total from the line items, and the three findings go away with it. The `principles` skill covers this: "Fix the root cause", "Redesign as if the requirement had always been there", and "Make bugs impossible by construction".

## 3. Gate

Stop and bring the decision to the user when the right fix for any group needs a major design decision or goes against a main assumption of the work. Signs:

- It changes a public API, a data model, a storage format, or a contract that other systems use.
- It goes against the plan, the architecture the user agreed to, or an assumption the user stated.
- It changes behavior that users see, in a way the request did not ask for.
- It redesigns code that the change did not touch.
- A reasonable engineer could pick a different option, and the options have real tradeoffs.

Do not edit code for this round. Give the user the problem with a concrete example, the options with their tradeoffs, and your recommendation. Include the triage of the other groups, so the user sees the full round. Continue when the user decides.

## 4. Fix

Fix one group at a time. Verify each fix with the narrowest check that proves it: the relevant tests, a type check, or a reproduction. Then start the next round.

## Stop

In a healthy loop, each round finds fewer findings, and less severe ones. Count surviving findings by severity each round so you can see the trend.

Stop the loop in one of these cases.

**The round is clean.** No P0, P1, or P2 finding survives triage. P3 findings alone do not start a new round; list them in the report.

**The loop is not converging.** Signs:

- New findings point at code that your fixes wrote.
- The same area or the same kind of finding comes back round after round.
- Neither the count nor the severity of surviving findings goes down across two rounds.
- Fixes go back and forth, for example A to B and back to A.
- Round 5 is not clean.

Churn usually means the root cause is above the code you are fixing: a design flaw or a wrong assumption. Do not start another round. Tell the user the pattern you saw and what you think the real cause is.

**From round 4, grow skeptical of findings that keep coming.** These are tendencies, not rules, so use judgment:

- Repeated P0s and P1s point to a system design problem. Fixing them one at a time will not converge. Stop and bring the pattern to the user.
- Repeated P2s and P3s tend to be bikeshedding. Raise the bar: fix a finding only if it has a concrete failure scenario, and reject the rest as not worth another round. If nothing survives, the round is clean.

A new, concrete bug that a recent fix introduced is still a bug. Fix it.

## Report

End with a short report:

- The number of rounds, the findings per round by severity, and why the loop stopped.
- Each root cause with the fix you chose (redesign, refactor, or patch) and the findings it closed.
- Rejected findings with their reasons.
- Open P3 findings.
- Out-of-scope findings, each with where it was escalated or filed.
- Decisions that are waiting for the user.
