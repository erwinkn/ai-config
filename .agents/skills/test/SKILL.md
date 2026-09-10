---
name: "test"
description: "Use when writing or revising meaningful behavioral tests, adding a regression case, or explicitly working test-first; use verify to run an existing acceptance procedure."
---

# Test

Own the test-design discipline, not all test execution. Preserve public behavior and useful feedback without doctrinaire assertions about a single test level.

## Assignment

implementer; verifier for an independent test audit.

Use the named agent definition for substantive delegated work. If you are already its assigned worker, execute this procedure directly; do not dispatch yourself again. Preserve the caller's endpoint and return mode. Read [shared rules](../principles/references/rules.md) and the relevant [principles](../principles/SKILL.md).

## Procedure

1. Choose an existing meaningful observation boundary and independent expected results. Agree a new consequential test seam only when needed.

2. For test-first work, add one behavior case, observe the relevant failure, implement that slice, and repeat.

3. For bugs, confirm the check fails for the reported symptom before the fix when practical.

4. Run nearby checks; explain any missing pre-fix evidence and the substitute check.

## Rules

- No blanket requirement that all expectations are literals; independent oracles, properties, and differential checks can be valid.
- Do not preserve tests that only mirror mocks or implementation structure.
- Practical inability to add a durable test does not waive the need for useful verification.

## Complete when

The tests can catch the intended defects and the actual outcomes are recorded.

Return or save change, evidence as needed under [artifact conventions](../../ARTIFACTS.md).

## Relevant detail

Read each applicable section before its step.

- [seams](SKILL.md#seams).
- [oracles](SKILL.md#oracles).

<a id="seams"></a>

## Seams

Choose an observation point that exercises the real behavior and can catch the relevant class of failure. Existing stable interfaces are preferred. Internal tests can be useful where their contract is meaningful; an overly shallow seam can miss the bug entirely. Ask the human only when choosing a seam also decides a consequential public interface or testing obligation. If no faithful seam exists, name the architectural gap and use the strongest practical temporary check without claiming permanent regression coverage.

<a id="oracles"></a>

## Oracles

Expected results must come from independent knowledge: explicit requirements, known examples, reference implementations, properties, or valid differential comparisons. Literal expected values are one option, not the only valid oracle. Avoid assertions that merely reconstruct the implementation, inspect only fixtures, or report that a mock was called without checking the meaningful effect. Verify that the relevant bad behavior can make the check fail. Negative and absence tests can be valuable when they observe the intended contract.
