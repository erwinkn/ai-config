---
name: "verify"
description: "Use when a claim of correctness, equivalence, performance, or readiness needs fresh evidence from the actual artifact; also when an existing project verification recipe must be followed."
---

# Verify

One verification capability selects the real surface and follows its project recipe. Optional recipe creation is a setup task, not automatic permission to modify the product.

## Assignment

verifier.

Use the named agent definition for substantive delegated work. If you are already its assigned worker, execute this procedure directly; do not dispatch yourself again. Preserve the caller's endpoint and return mode. Read [shared rules](../principles/references/rules.md) and the relevant [principles](../principles/SKILL.md).

## Procedure

1. State the claim, target revision, expected result, and the smallest faithful procedure.

2. Check target identity and readiness; reuse existing tests or project run instructions.

3. Execute the procedure, inspect actual outputs and side effects, and compare baseline/treatment when the claim needs comparison.

4. Return observed results and limitations. Clean up only owned resources while retaining evidence.

## Rules

- Missing setup is blocked, not passed. A screenshot without the discriminating state proves nothing.
- A patch-id match alone does not establish behavior against a changed base.
- Visual diff thresholds and performance tolerances are agreed before interpreting the result.

## Complete when

The claim is supported, refuted, or explicitly inconclusive, with reproducible evidence.

Return or save evidence as needed under [artifact conventions](../../ARTIFACTS.md).

## Relevant detail

Read each applicable section before its step.

- [surfaces](references/surfaces.md).
- [recipes](SKILL.md#recipes).
- [comparisons](SKILL.md#comparisons).

<a id="recipes"></a>

## Recipes

Follow the project’s established verification commands and user-path map. If no adequate recipe exists, identify the gap and ask for the manual setup workflow when creating reusable guidance is outside the current task. A task-scoped probe may still be built within existing implementation authority. A recipe is not trusted merely because its Markdown looks plausible: setup proves a representative path and that cleanup retains the evidence.

<a id="comparisons"></a>

## Comparisons

Pin the relevant baseline, treatment, data, environment, and procedure. Compare the same claim, not unlike workloads. For a feature absent on the baseline, verify the new acceptance criteria and relevant regression constraints rather than invent an old result or invalid ratio. State noise and visual tolerance before interpreting results. A unchanged patch hash does not prove unchanged behavior under new dependencies or base code. Missing or incomparable evidence produces an inconclusive result.
