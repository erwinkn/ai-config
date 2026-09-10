---
name: "babysit"
description: "Use during a full delivery to carry an open PR to merge-ready, or when the user requests PR follow-through; a status-only question still gets one check."
---

# Babysit

Keep status, feedback resolution, and watching together without conflating readiness with permission to merge.

## Assignment

lead.

Use the named agent definition for substantive delegated work. If you are already its assigned worker, execute this procedure directly; do not dispatch yourself again. Preserve the caller's endpoint and return mode. Read [shared rules](../principles/references/rules.md) and the relevant [principles](../principles/SKILL.md).

## Procedure

1. Resolve the exact PR or stack and scope: one check, feedback only, or follow-through to merge-ready. A full delivery already authorizes follow-through; do not ask again.

2. Read current head, checks, reviews, unresolved threads, mergeability, and important base changes. Act on posted actionable feedback without waiting for unrelated checks to finish.

3. Use integrate for legitimate fixes, then refresh state and invalidate stale proof. Material fix-loop churn returns through simplify and review. Work dependent blockers before pretending the upper stack is ready.

4. Wait using actual supported host facilities only. Maintain the canonical log through meaningful decisions and fixes; a native tool failure or budget limit produces a checkpoint, not imaginary monitoring.

5. When autonomous repairs and checks settle, return control to deliver for final audit publication and final current-head readiness; standalone babysit uses the same audit skill for a substantive changed PR before its final ready report. Unavailable historical evidence is disclosed.

6. Stop at true merge-ready, user stop, terminal remote state, or an honest blocked/checkpoint result. Report external approvals and other residuals explicitly.

## Rules

- No merge or auto-merge authority follows from readiness.
- One PR owner and one topology writer; do not let multiple babysitters mutate the same target.
- Required human approvals cannot be fabricated or waived. Pending required reviews or tests mean not merge-ready.
- A nonblocking accepted risk may remain visible; an unresolved acceptance or safety blocker may not be relabeled a note.

## Complete when

The requested status or full follow-through is delivered honestly, including the current head, audit state, and pending human or external requirements.

## Relevant detail

Read each applicable section before its step.

- [watch](SKILL.md#watch).
- [stacks](SKILL.md#stacks).

<a id="watch"></a>

## Watch

A full delivery invokes watch/follow-through automatically to merge-ready; status-only still performs one snapshot. Read the exact current head, actionable feedback, checks, approvals, and mergeability. Process real feedback and CI repairs, record important judgments, and invalidate old-head results after a push. Use supported native wait/continuation only. Missing human approval or host capability is a visible waiting/blocker/checkpoint state. Return to the lead for final audit publication and current-head readiness; never arm a merge.

<a id="stacks"></a>

## Stacks

Identify whether the PRs are actually dependent and which lower change blocks the rest. Keep one target owner and avoid restarting lower checks for opportunistic upper-stack fixes. Report conflicts/topology work to the canonical owner. Babysit stops at readiness and does not retarget, force-push, or merge merely to advance a queue. Shipping the chain uses ship’s stack section after authorization.
