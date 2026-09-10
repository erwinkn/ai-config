---
name: "simplify"
description: "Use after substantive implementation or material review/fix iterations to reassess the complete changed behavior and improve its structure while preserving requirements; a full from-scratch PR replacement requires manual rewrite."
---

# Simplify

A normal quality step, not optional cosmetic cleanup. Optimize the final structure against settled requirements; the pass may make no edit when the design is already good.

## Assignment

simplifier; designer for a genuinely unresolved structure; reviewer assesses resulting changes.

Use the named agent definition for substantive delegated work. If you are already its assigned worker, execute this procedure directly; do not dispatch yourself again. Preserve the caller's endpoint and return mode. Read [shared rules](../principles/references/rules.md) and the relevant [principles](../principles/SKILL.md).

## Procedure

1. Pin the current requirements and obligations: outputs, errors, state transitions, ordering, persistence, permissions, safety, compatibility, performance, observability, and UX where applicable.

2. Read the whole changed behavior and its relevant integration seams, not only the last diff hunk. Identify accumulated special cases, duplicated state, unnecessary abstractions, wrappers, and stale iteration scaffolding.

3. Restructure the in-scope implementation where this materially simplifies the model, even when another implementation pass is required. Use design for an unresolved shape instead of moving complexity between files.

4. Preserve useful rationale and valid safeguards. Remove only elements whose obligations are demonstrably met by the new structure; fewer lines alone is not success.

5. Rerun relevant checks and return the new diff, benefits, preserved obligations, decisions, and uncertainty. The caller obtains fresh review and final verification for changed code.

## Rules

- Structural ambition does not authorize new product behavior, expanded external contracts, unrelated cleanup, or deletion of unproven safeguards.
- Full clean reimplementation of an existing PR is a different manual-only rewrite playbook; never invoke it as an automatic escalation.
- A substantive delivery always gets the assessment, but no code change or fixed percentage of deletion is required.
- After material review-fix churn, reassess the integrated result before the final audit and acceptance.

## Complete when

The same required behavior is preserved with lower complexity, or no worthwhile edit is made.

Return or save change, evidence as needed under [artifact conventions](../../ARTIFACTS.md).

## Relevant detail

Read each applicable section before its step.

- [comments](SKILL.md#comments).

<a id="comments"></a>

## Comments

Delete narration, obsolete code, and misleading explanations when the actual surrounding behavior justifies it. Keep public contracts, required notices, important external constraints, and non-obvious reasoning. A comment describing an internal constraint is a candidate for a type, test, invariant check, or clearer design; it is not proof that the comment must be deleted immediately. Preserve its information until a justified replacement actually carries it. Inspect suppressions by what they permit, not by their spelling. Correctness-preserving exceptions can be necessary; weakening safety to satisfy a comment-removal rule is not simplification.
