---
name: "audit"
description: "Use before declaring a substantive PR merge-ready, after material changes invalidate its prior audit, or when the user requests an audit of the work and decisions behind a change."
---

# Audit

Turn the canonical decision log into a confidence-graded, evidence-linked PR artifact. This is an independent audit of decisions and claimed proof, not a second full code review.

## Assignment

auditor; lead supplies records and owns corrections/publication.

Use the named agent definition for substantive delegated work. If you are already its assigned worker, execute this procedure directly; do not dispatch yourself again. Preserve the caller's endpoint and return mode. Read [shared rules](../principles/references/rules.md) and the relevant [principles](../principles/SKILL.md).

## Procedure

1. Pin the requirements, target base and code revision, canonical log, review dispositions, checks, and available tool/session records. Record unavailable evidence rather than invent it.

2. Check important log entries against actual artifacts. Identify unsupported claims, missing decisions, skipped checks, and abandoned approaches that shaped the result.

3. Assign evidential support to each significant claim: Verified (direct relevant observation), Supported (concrete indirect or partial evidence), Unverified (insufficient evidence), or Contradicted (evidence conflicts). Treat explicit user choices as sourced decisions, not facts needing a probability.

4. Separate evidential support from consequence: a minor unverified detail and an unverified data-safety claim are not equally risky. Name blockers, accepted residual risks, and what would close each gap.

5. Return audit.md with the reviewed revision, links to log entries and evidence, final requirement coverage, key tradeoffs and reversals, limitations, and attention items. The lead fixes log errors by a correction entry, obtains missing proof, or reports an honest blocker before publication.

## Rules

- No invented numerical confidence scores, blanket assurance, or claim that reviewer agreement is runtime proof.
- Missing required evidence blocks merge-ready; known optional limitations may remain with a clear disposition.
- The audit reads concise recorded rationale and available operational records; it does not require or expose hidden reasoning.
- A new code, contract, or relevant base revision invalidates affected conclusions; audit-document publication alone does not require repeating unchanged semantic checks. Still observe required CI at the current PR head.
- Do not rewrite log history or claim a different-model audit ran when that executor was unavailable.

## Complete when

A durable audit accurately explains the decision history, proof, confidence limits, and remaining risks at the named revision.

Return or save findings, record, evidence as needed under [artifact conventions](../../ARTIFACTS.md).

## Relevant detail

Read each applicable section before its step.

- [report](SKILL.md#report).

<a id="report"></a>

## Report

Use this report structure: reviewed requirements/base/code revision; source record and available evidence; requirement coverage; significant decisions; rejected or reverted approaches; residual risks and blockers; final disposition. For each significant decision, show its log id, what was chosen, concise reason, evidence pointers, support label, and impact. Support labels are Verified, Supported, Unverified, and Contradicted. They describe the cited claim under the tested conditions, not a probability that the entire system is safe. An explicit product preference is marked as an explicit user decision with its source; independently assess any implementation claims made about it. Include an Attention section even when its value is no unresolved concerns found within the reviewed scope. The audit does not approve its own factual claims through rhetorical confidence or replace current PR checks.
