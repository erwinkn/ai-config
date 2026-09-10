---
name: "rewrite"
description: "/rewrite <PR> — rebuild a selected PR from its validated semantic and operational requirements in a fresh worktree; manual-only and never automatically called by deliver."
disable-model-invocation: true
---

# Rewrite

An experimental second-draft workflow for a PR that accumulated complexity across iterations. Reimplement the PR’s contribution from the target base, not the entire repository, while retaining every accepted requirement and keeping the original recoverable.

## Assignment

lead owns the workflow; analyst reconstructs requirements; simplifier authors the new candidate; reviewer and reviewer-second review; verifier tests; auditor audits.

Use the named agent definition for substantive delegated work. If you are already its assigned worker, execute this procedure directly; do not dispatch yourself again. Preserve the caller's endpoint and return mode. Read [shared rules](../principles/references/rules.md) and the relevant [principles](../principles/SKILL.md).

## Procedure

1. Freeze the original PR head, target base, and references to its discussion, plan, tests, and decision log. Preserve the original branch and any unrelated user work before writing a candidate.

2. Have analyst reconstruct a requirement-and-obligation checklist from the final PR, original user intent, accepted feedback, observed behavior, and existing constraints. Include error behavior, ordering, persistence, retries, permissions, compatibility, performance, observability, accessibility, and rollout requirements when present. Label accidental behavior and contradictions instead of canonizing every current line.

3. Validate the checklist against the sources. Resolve genuinely ambiguous requirements before replacing behavior; do not re-ask settled decisions. Pin useful acceptance tests and observations independently of the new implementation.

4. Create a fresh candidate worktree from the frozen target base. Seed the simplifier with the validated contract, relevant project architecture, and selected evidence, not an instruction to edit the old patch. Derive a simpler design and implement the full PR contribution anew. Use design or swarm compare only when additional alternatives earn their cost.

5. Compare both candidates against each requirement. Preserve useful regression and characterization tests, add independent checks for discovered obligations, and examine representative runtime and operational behavior. Test the new candidate through the same meaningful surfaces; do not weaken the acceptance criteria to make it pass.

6. Review the new candidate in fresh contexts using reviewer and reviewer-second; integrate legitimate findings. Judge reduced incidental complexity, fewer moving parts, explicit invariants, and maintainability alongside correctness and operational proof. Lines removed are a diagnostic, not the objective.

7. Audit the replacement decisions and evidence. If the candidate loses a required behavior or is not demonstrably better structured, retain the original and report the experiment without replacing it.

8. When the candidate is better, publish as a separate comparison/replacement PR by default and carry it through babysit and audit to merge-ready. Do not overwrite or force-push the original PR, close it, merge, or deploy without the corresponding explicit authority. An explicit original-branch replacement uses a documented safe transfer while preserving the pinned original.

9. Hand back the comparison, requirement coverage, evidence, rejected compromises, final audit, and exact PR state. One clean rewrite is the default attempt; more drafts require explicit direction or a pre-agreed finite experiment budget.

## Rules

- Manual-only: deliver may mention the opportunity but cannot invoke this skill, read its body as a workaround, or launch an equivalent full-rewrite subtask on its own.
- From scratch means the PR’s intended contribution is reimplemented against the fixed base, not a repository reset or wholesale system rewrite.
- The final intended contract is authoritative, not a count of tests or the current patch’s structure. Known bugs and unsupported incidental behavior are not automatically protected.
- Retain necessary safety checks, compatibility, operational behavior, and meaningful rationale. Removing them requires evidence that their obligations remain met, not aesthetic preference.
- A fresh worktree alone does not guarantee a fresh perspective: use a fresh writing context and requirements-first input; old implementation may be inspected for a specific factual gap.
- Missing comparative evidence is inconclusive, not permission to replace the original. All publication follows the caller’s authority.

## Complete when

A better, independently reviewed and verified candidate reaches merge-ready with a comparison and decision audit, or the original is retained with an honest experimental result.

Return or save plan, change, findings, evidence, record as needed under [artifact conventions](../../ARTIFACTS.md).

## Relevant detail

Read each applicable section before its step.

- [contract](references/contract.md).
