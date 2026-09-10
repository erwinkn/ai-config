---
name: "deliver"
description: "Use when the user authorizes a feature, repair, refactor, or implementation plan, including a multi-unit change; not when only research or planning was requested."
---

# Deliver

Feature, repair, and refactor branches share one full delivery workflow. Once execution starts, the default endpoint is a merge-ready PR with an audited work record; structural improvement is part of quality, not an optional extra.

## Assignment

lead.

Use the named agent definition for substantive delegated work. If you are already its assigned worker, execute this procedure directly; do not dispatch yourself again. Preserve the caller's endpoint and return mode. Read [shared rules](../principles/references/rules.md) and the relevant [principles](../principles/SKILL.md).

## Procedure

1. Confirm the authorized outcome and any narrower endpoint already stated. Open the canonical decision log before substantive work. Repair starts with diagnose; refactor starts by pinning preserved behavior; feature work starts from settled intent.

2. Use plan at the needed scale. Revisit design when the existing abstraction causes the problem; include necessary in-scope restructuring rather than prefer the smallest patch. Ask only for genuinely new product choices, conflicting constraints, or scope/authority changes.

3. Delegate to implementer-fast, implementer, or implementer-deep by the documented task conditions. Use swarm for valuable independent work, separate worktrees, and one canonical integrator. Record consequential returned decisions and evidence.

4. After substantive implementation, run simplify, then a fresh review. Integrate accepted findings and repeat relevant quality/verification steps after material changes. Keep the final candidate coherent; do not accumulate fixes merely to quiet reviewers.

5. Run verify against the final code and requirements. Use ship for focused commits, branch push, and PR creation/update; an early draft is permitted while the work is unfinished.

6. Invoke babysit automatically as part of this delivery grant. Address current review feedback and CI, refresh proof after mutations, and reassess structure after material churn. No full rewrite unless the user invokes the separate manual command.

7. Run audit after substantive work has settled. Correct inaccurate records and unresolved required evidence; publish the audit and redacted canonical log as durable PR artifacts.

8. Check the exact current PR head after audit publication: required checks, review requirements, mergeability, resolved blockers, complete task acceptance, and accessible audit. Report merge-ready and stop. Do not merge, arm auto-merge, or deploy. Preserve a checkpoint when the host or authority prevents completion.

## Rules

- The implementation worker returns locally; the lead owns the entire delivery tail.
- Do not turn a one-line mechanical edit into unnecessary design contests, but retain relevant checks and record substantive decisions when they exist.
- A small diff is not a justification for ignoring the structural cause of a defect.
- New product behavior, external compatibility changes, and explicit mutation-boundary crossings still need their own decision.
- Review fixes and simplification invalidate affected evidence; an earlier passing result does not certify later code.
- No mandatory full PR rewrite, no default merge, and no claimed ongoing monitoring without host support.

## Complete when

The current PR is actually merge-ready with requirements, quality, review, checks, and decision audit accounted for, or a precise recoverable blocked/checkpoint result is returned.

## Relevant detail

Read each applicable section before its step.

- [variants](SKILL.md#variants).
- [parallel](SKILL.md#parallel).
- [multi unit](references/multi-unit.md).
- [unattended](references/unattended.md).
- [record](references/record.md).

<a id="variants"></a>

## Variants

Feature: settle the intended new behavior and design, then implement. Repair: demonstrate the symptom and causal mechanism; change the abstraction or ownership when that removes the cause rather than layering guards. Refactor: pin the required current behavior and change structure. All three converge on implementation, a substantive simplification assessment, fresh review, accepted repairs, final verification, PR publication, babysit, and decision audit. A local-only or explicit partial-stage request narrows that tail. Full PR rewrite is never an automatic branch.

<a id="parallel"></a>

## Parallel

Use swarm for partitioned work or competing candidates. The procedure supplies the actual task, budget, and role assignments; swarm owns dispatch/collection instructions. Parallel writers have separate worktrees and never share the canonical log. The lead integrates and appends consequential worker decisions; one active writer occupies each worktree. Keep domain-coupled work coherent rather than splitting it solely to increase concurrency.
