---
name: "review"
description: "Use when a code change, design, plan, or agent instruction needs independent assessment against its intent and applicable standards; not to apply existing PR feedback."
---

# Review

Independent assessment of intent, correctness, and structure. Additional model assignments provide real independent perspectives without creating a role for every review topic.

## Assignment

reviewer; reviewer-second for consequential, contested, or rewrite comparisons.

Use the named agent definition for substantive delegated work. If you are already its assigned worker, execute this procedure directly; do not dispatch yourself again. Preserve the caller's endpoint and return mode. Read [shared rules](../principles/references/rules.md) and the relevant [principles](../principles/SKILL.md).

## Procedure

1. Pin the artifact/revision, requirements, scope, and necessary surrounding context. Do not let the author’s rationale substitute for reading the code.

2. Assess intent and correctness separately from standards and structural quality. Propose root-cause or abstraction improvements when supported, including a further implementation pass where worthwhile.

3. Use conditional security, reliability, migration, performance, test, and UX lenses when their subject is present. Invoke reviewer-second in a fresh context for consequential or contested findings and the final full-rewrite candidate.

4. Adjudicate findings against evidence rather than votes. Return impact, proposed action, counterevidence, uncertainty, and coverage gaps; do not fix code from inside review.

## Rules

- Default is report-only; no implicit edits, branch switch, ticket creation, or external disclosure.
- Do not force findings, treat size thresholds as universal laws, or equate consensus with truth.
- A missing spec or unavailable peer is a visible coverage limitation.

## Complete when

Each finding has evidence and impact; a clean result or limited coverage is reported honestly.

Return or save findings as needed under [artifact conventions](../../ARTIFACTS.md).

## Relevant detail

Read each applicable section before its step.

- [lenses](references/lenses.md).
- [findings](SKILL.md#findings).

<a id="findings"></a>

## Findings

Each substantive finding names the artifact/revision, relevant location, affected requirement or invariant, plausible failure path, evidence, impact, and proposed next action. Keep a concrete false positive or disagreement visible until adjudicated. Distinguish accepted fixes, considerations, dismissed claims with reasons, and human decisions. Do not auto-apply during review or make majority agreement the acceptance rule. Consolidate duplicated findings without losing a unique supported observation.
