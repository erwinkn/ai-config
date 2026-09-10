---
name: "swarm"
description: "Use when explicitly asked for a swarm, arena, competing attempts, or parallel coverage, or when a calling procedure has useful independent work to fan out."
---

# Swarm

One reusable skill covers partitioned coverage and competing candidates. These are modes inside the skill, not new meta-concepts or a custom runtime.

## Assignment

lead coordinates; worker role selected from the artifact task; reviewer or reviewer-second judges comparisons.

Use the named agent definition for substantive delegated work. If you are already its assigned worker, execute this procedure directly; do not dispatch yourself again. Preserve the caller's endpoint and return mode. Read [shared rules](../principles/references/rules.md) and the relevant [principles](../principles/SKILL.md).

## Procedure

1. Define the goal, output, scope, budget, and mode: partition for disjoint coverage, compare for independent attempts at the same problem, or an explicitly specified mixture.

2. Select worker roles from the actual task and their configured models. Give each writer its own worktree and output; settle shared contracts before partitioning.

3. Dispatch bounded packets with the required inputs, owned paths, acceptance criteria, and return shape. Keep every relevant independent candidate context separate.

4. For partition, collect every required slice and integrate through one owner. For compare, wait for candidates, assess each against declared criteria, and choose a coherent base; graft only compatible ideas and reverify.

5. Return the result, evidence, what was accepted or rejected, substitutions, dropouts, and uncovered work. Clean up only owned temporary execution state.

## Rules

- A missing coverage slice is a gap, not a successful smaller swarm.
- Do not share a writable worktree, canonical log, browser session, or service instance between simultaneous writers.
- The caller chooses the task endpoint; this skill does not invent publishing or merging authority.
- No mandatory agent count, fake independence, opaque majority vote, or silent alternative model assignment.
- A deterministic script is preferable when it can do the whole mechanical operation faithfully.

## Complete when

The chosen artifact or coverage report is backed by collected results; missing evidence and dropout are explicit.

Return or save change, research, findings, evidence, record as needed under [artifact conventions](../../ARTIFACTS.md).

## Relevant detail

Read each applicable section before its step.

- [partition](SKILL.md#partition).
- [compare](SKILL.md#compare).

<a id="partition"></a>

## Partition

Partition by genuinely independent questions or owned outputs after shared prerequisites are settled. Each required slice needs a result or explicit gap. Do not turn coverage into a race by accepting the first success and abandoning unexamined slices. The task determines scout, analyst, designer, implementation tier, reviewer, or verifier; all use existing agent definitions. No shared writing worktree or canonical log.

<a id="compare"></a>

## Compare

For competing attempts, give independent candidates the same goal, requirements, budget, and frozen starting state with separate output paths. Define selection criteria before seeing results. Use reviewer or reviewer-second for independent assessment without leading with author identity. Choose a coherent base and selectively incorporate compatible ideas; reverify the synthesized artifact. A fast-race mode must be explicitly requested and cannot masquerade as reading or judging every candidate.
