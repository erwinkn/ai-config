---
name: "handoff"
description: "Use when the user pauses, resumes, transfers, or recalls in-flight work, or when a context boundary requires preserving task state."
---

# Handoff

One capability covers save, pickup, and scoped recall. It does not invent a separate continuation runtime.

## Assignment

lead; scout/analyst may reconstruct prior evidence.

Use the named agent definition for substantive delegated work. If you are already its assigned worker, execute this procedure directly; do not dispatch yourself again. Preserve the caller's endpoint and return mode. Read [shared rules](../principles/references/rules.md) and the relevant [principles](../principles/SKILL.md).

## Procedure

1. For a pause, finish or safely stop the current atomic operation and stop starting new work.

2. Save goal, decisions, artifact pointers, exact code/remote state, actual checks, open work, and the next action.

3. For pickup, read that record and reconcile the current branch, files, remote state, and required resources.

4. Reuse still-valid evidence; rerun only what changed or what a consequential next step requires. Continue under the appropriate existing playbook.

## Rules

- A WIP commit requires commit authority; a local note or patch may be the appropriate preservation method.
- Do not trust stale completion marks blindly or repeat the whole investigation by default.
- A handoff never claims that another agent was launched unless the host actually launched it.
- Reference the canonical decision log and current PR audit; do not copy them into a rival history or treat a stale audit as current proof.

## Complete when

A cold-start reader can identify the true state and next action without recreating the session.

Return or save handoff, record as needed under [artifact conventions](../../ARTIFACTS.md).

## Relevant detail

Read each applicable section before its step.

- [continuation](SKILL.md#continuation).

<a id="continuation"></a>

## Continuation

A continuation note records goal, scope/authority, settled decisions, actual branch/commit/PR state, changed paths, checks performed, retained evidence, failed approaches worth avoiding, owned active resources, and the next action. Reference existing artifacts rather than duplicate them. On resume, reconcile what changed and reuse still-valid evidence. Preserve progress before a context reset using the host’s supported mechanism; never pretend that writing a note launched another session.
