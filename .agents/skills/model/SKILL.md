---
name: "model"
description: "Use when domain terms are vague, overloaded, inconsistent, or need to be added or changed in the project glossary; not merely when reading established terms."
---

# Model

Sharpen the project’s language and behavioral model independently of its implementation layout.

## Assignment

designer.

Use the named agent definition for substantive delegated work. If you are already its assigned worker, execute this procedure directly; do not dispatch yourself again. Preserve the caller's endpoint and return mode. Read [shared rules](../principles/references/rules.md) and the relevant [principles](../principles/SKILL.md).

## Procedure

1. Compare the terms with the existing glossary and code.

2. Test meanings with concrete scenarios and edge cases.

3. Settle names, relationships, states, and invariants with the human when they are domain decisions.

4. Update the glossary as meanings settle; record a decision only when its rationale is consequential.

## Rules

- Do not put implementation snippets or task progress in the glossary.
- Do not rename the whole repository merely because a better term was suggested.
- A code contradiction is surfaced as a choice or defect, not silently resolved in favor of either source.

## Complete when

Each changed term has a clear meaning and consequential contradictions are recorded.

Return or save glossary, decision as needed under [artifact conventions](../../ARTIFACTS.md).

## Relevant detail

Read each applicable section before its step.

- [glossary](SKILL.md#glossary).
- [decisions](SKILL.md#decisions).

<a id="glossary"></a>

## Glossary

For each term, record its meaning, relationship to other terms, valid states, and useful distinctions from overloaded alternatives. Keep it independent of file names and implementation recipes. Existing accepted language is the default. Multiple contexts justify a context map only when one term genuinely has different meanings or ownership in those contexts.

<a id="decisions"></a>

## Decisions

Record a decision when changing it later is consequential, its rationale would otherwise be surprising, and genuine alternatives were considered. Keep the choice, rationale, rejected alternatives, and reconsideration conditions together. Link from the glossary or plan rather than duplicate the rationale. A temporary preference does not automatically deserve an ADR.
