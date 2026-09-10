---
name: "research"
description: "Use when a task needs code, documentation, history, or prior-work evidence before an answer or change; not to redesign the system."
---

# Research

One entry point for locating evidence and understanding the existing system. Replaces separate where/how/why retrieval commands without erasing those different questions.

## Assignment

scout → analyst when synthesis is needed.

Use the named agent definition for substantive delegated work. If you are already its assigned worker, execute this procedure directly; do not dispatch yourself again. Preserve the caller's endpoint and return mode. Read [shared rules](../principles/references/rules.md) and the relevant [principles](../principles/SKILL.md).

## Procedure

1. Pin the question and relevant project/source scope. Read the supplied task and essential contracts first.

2. Search code, history, existing decisions, and external primary sources as the question warrants. Partition independent source searches only when that saves useful effort.

3. Escalate mechanism or rationale analysis to analyst; retain evidence pointers and confidence distinctions.

4. Return the answer, relevant paths, and remaining gaps. Save a research artifact only when another step or session needs it.

## Rules

- Describe what exists before recommending changes; read-only means no unrequested product or runtime mutation.
- Evidence selection follows the question: do not require a seven-service search for a single-file answer.
- Facts that changed after a saved note was written come from current sources; notes preserve historical reasoning.

## Complete when

The named question is answered with sources, or its missing evidence is explicit.

Return or save research as needed under [artifact conventions](../../ARTIFACTS.md).

## Relevant detail

Read each applicable section before its step.

- [mechanisms](SKILL.md#mechanisms).
- [history](references/history.md).
- [prior work](SKILL.md#prior-work).

<a id="mechanisms"></a>

## Mechanisms

Locate the relevant entry points, follow data and control flow, and identify ownership, configuration, and observable effects. Scouts return locations and examples; analyst constructs the mechanism account. Read surrounding code needed to check the explanation. Keep the existing implementation distinct from recommendations for a replacement.

<a id="prior-work"></a>

## Prior work

Limit recall to the named workspace, topic, and time interval. Read relevant prior task records and inspect actual code/PR state before labeling work merged, open, reverted, or merely planned. Preserve decisions and failed approaches that matter now. For a human activity recap, summarize outcomes; for continuation, hand the reconstructed state to handoff.
