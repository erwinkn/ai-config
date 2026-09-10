---
name: "optimize"
description: "Use when the user asks to improve a measurable target or reduce a defined codebase problem through repeated bounded changes, and the winning change is not already known."
---

# Optimize

Unify hillclimbing, performance optimization, and controlled recurring upkeep. A scheduled invocation is just another bounded run of this playbook.

## Assignment

lead.

Use the named agent definition for substantive delegated work. If you are already its assigned worker, execute this procedure directly; do not dispatch yourself again. Preserve the caller's endpoint and return mode. Read [shared rules](../principles/references/rules.md) and the relevant [principles](../principles/SKILL.md).

## Procedure

1. Name the target, scope, relevant workload, regression constraints, and stopping budget.

2. Run a baseline and confirm that the observation can distinguish the problem. Use diagnose for cost attribution.

3. Select a justified hypothesis, implement one change in isolation, and verify its effect.

4. Keep supported wins and revert unsupported changes. Record both positive and negative results.

5. Record each consequential hypothesis, observation, kept or reverted change in the canonical log. A research-only optimization returns its measured finding; an authorized production-change run finishes through deliver’s review, PR, babysit, and audit tail unless a narrower endpoint was specified.

## Rules

- Do not move the success threshold or weaken the measurement to call a win.
- A quality sensor needs a genuine relation to the desired outcome; fewer comments or more tests is not automatically better.
- Scheduling and wakeups use existing host features only; this stack does not implement them.
- A metric win is rejected if it loses required semantic or operational behavior. Structural simplification can be worthwhile even when the metric is unchanged.

## Complete when

A measured change, negative finding, or honest checkpoint is available.

## Relevant detail

Read each applicable section before its step.

- [measurement](SKILL.md#measurement).
- [recurring](SKILL.md#recurring).

<a id="measurement"></a>

## Measurement

Choose a realistic workload and a metric connected to the requested outcome. Establish baseline and regression constraints before candidate changes. Use repeated/interleaved observations when noise matters and preserve the same measurement procedure across comparable attempts. Attribute bottlenecks before optimizing convenient code. Keep or revert each tested hypothesis; record negative results so another attempt does not repeat them. A measurement change is a separate justified decision, not a way to make the candidate win.

<a id="recurring"></a>

## Recurring

For recurring upkeep, specify the target condition, a useful measurement, how the next bounded item is selected, permitted edits, required checks, and where feedback is recorded. Reconcile concurrent changes before acting. Prefer an optional check that prevents new regressions while old cases are repaired. Each invocation ends with one reviewable increment or a no-op; recurrence is an existing host schedule, not a new controller or seventh concept. The same procedure can be invoked manually.
