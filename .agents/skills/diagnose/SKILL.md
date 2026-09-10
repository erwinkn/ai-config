---
name: "diagnose"
description: "Use when behavior is broken, flaky, slow, or unexplained, or when interpreting a supplied runtime trace; diagnosis alone does not authorize a repair."
---

# Diagnose

Unify debugging, live forensics, and captured-trace analysis while preserving their different evidence limits.

## Assignment

analyst; scout for locating evidence.

Use the named agent definition for substantive delegated work. If you are already its assigned worker, execute this procedure directly; do not dispatch yourself again. Preserve the caller's endpoint and return mode. Read [shared rules](../principles/references/rules.md) and the relevant [principles](../principles/SKILL.md).

## Procedure

1. State the exact symptom and construct the cheapest faithful observation loop; inspect a supplied trace before inventing a new reproduction.

2. Minimize when useful, form competing hypotheses, and distinguish implementation defects from invalid domain, ownership, lifecycle, or abstraction assumptions.

3. Confirm the causal mechanism as far as access permits. Repeated failed patches trigger investigation of the premise and surrounding structure.

4. Return the supported cause, ruled-out hypotheses, uncertainty, and the coherent repair, including a necessary refactor or redesign when the evidence calls for it. Record diagnostic turning points and failed hypotheses.

## Rules

- Do not claim a single captured trace proves a causal fix.
- Instrumentation can mutate a running system and needs appropriate authority even when source files remain unchanged.
- Cleanup temporary instrumentation and preserve the useful evidence.

## Complete when

A cause is supported by evidence, or the remaining hypotheses and next useful probe are explicit.

Return or save research, evidence as needed under [artifact conventions](../../ARTIFACTS.md).

## Relevant detail

Read each applicable section before its step.

- [reproduction](SKILL.md#reproduction).
- [forensics](SKILL.md#forensics).

<a id="reproduction"></a>

## Reproduction

Try an existing test, request, CLI invocation, browser path, trace replay, small harness, property/fuzz loop, bisect, or differential comparison according to the symptom. Tighten scope, runtime, and determinism enough to make progress. For intermittent failures, compare repeated observations and reproduction rate. A human-only reproduction is a last-resort limitation to state, not a reason to invent observations. Preserve the original scenario alongside any minimized repro.

<a id="forensics"></a>

## Forensics

Choose live diagnosis when a running process must be observed, and captured analysis when the user supplied an existing profile, trace, spindump, or heap snapshot. Parse large data into a queryable form when that helps. Trace hot frames or retainer paths back to actual source and pinned versions. A paired capture or discriminating experiment can strengthen a causal claim; one snapshot often supports only a hypothesis. Permission to inspect does not automatically permit a production hotpatch or private-data capture.
