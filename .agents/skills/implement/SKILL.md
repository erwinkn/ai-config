---
name: "implement"
description: "Use when a calling playbook delegates an owned implementation unit, or the user explicitly requests the implementation step alone; use deliver for a complete feature or repair."
---

# Implement

Build one owned change. Parallel implementation and shipping belong to the caller, not to this skill’s hidden tail.

## Assignment

implementer by default; implementer-fast for settled mechanical edits; implementer-deep for difficult semantics.

Use the named agent definition for substantive delegated work. If you are already its assigned worker, execute this procedure directly; do not dispatch yourself again. Preserve the caller's endpoint and return mode. Read [shared rules](../principles/references/rules.md) and the relevant [principles](../principles/SKILL.md).

## Procedure

1. Read the assigned outcome, owned scope, requirements, design, and relevant project conventions. Consider whether the existing abstraction is the reason the requested change is difficult.

2. Establish faithful checks; use test for behavior-first increments and a demonstrated failure before a known bug repair.

3. Implement the simplest coherent solution that satisfies all requirements, even when an in-scope refactor is larger than a local patch. Return a necessary design reconsideration to the lead rather than silently add workarounds.

4. Run local checks and return the diff, evidence, consequential decisions, rejected attempts, deviations, and remaining work for the lead’s log. Do not run the parent delivery tail.

## Rules

- Do not spawn unbounded nested workers; return a proposed split when the task is too broad.
- Do not weaken tests or types to make the implementation appear correct.
- Do not add an independent review, PR, babysitter, or merge unless the caller delegates that exact responsibility.

## Complete when

The scoped change is implemented and locally checked, or a precise partial result is returned.

Return or save change, evidence as needed under [artifact conventions](../../ARTIFACTS.md).

## Relevant detail

Read each applicable section before its step.

- [coding](SKILL.md#coding).

<a id="coding"></a>

## Coding

Apply project conventions and the relevant principles before writing. Favor honest state models, explicit boundaries, total functions where useful, and existing canonical helpers. Preserve meaningful runtime checks, compatibility, accessibility, errors, and ordering. Consider retry/partial-completion behavior for operations exposed to retries. Language examples are conditional: TypeScript unions or schema inference, React prop narrowing, and native-platform lifecycle checks apply only to those projects. Do not impose a universal library, language idiom, or prohibition on all casts. The cheapest local patch is not the default when the abstraction causes the defect. Within the agreed scope, prefer the simplest coherent redesign that satisfies all obligations. Mechanical units use implementer-fast, ordinary ones implementer, difficult semantic work implementer-deep; a settled result gets a separate simplifier pass.
