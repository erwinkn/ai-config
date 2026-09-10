---
name: "plan"
description: "Use when settled requirements need a specification, implementation plan, ticket breakdown, or focused revision of an existing plan; do not restart discovery without a real gap."
---

# Plan

One plan owns WHAT and HOW in separate sections. A short request can stay in chat; multi-session work needs a durable plan and self-contained units.

## Assignment

designer; lead owns user settlement.

Use the named agent definition for substantive delegated work. If you are already its assigned worker, execute this procedure directly; do not dispatch yourself again. Preserve the caller's endpoint and return mode. Read [shared rules](../principles/references/rules.md) and the relevant [principles](../principles/SKILL.md).

## Procedure

1. Synthesize the goal, non-goals, acceptance criteria, and settled constraints from the conversation or source artifact without restarting the interview.

2. Keep specification, chosen architecture, implementation sequence, and any requested tickets in one cohesive planning workflow. Mark requirements-only versus executable sections in plain language.

3. Choose coherent units, prerequisites, verification, and ownership. Allow necessary structural changes; separate genuinely unresolved decisions from ready units.

4. Record the default delivery endpoint as merge-ready PR unless the user chose another endpoint. Record the canonical decision-log location and PR audit expectation for implementation. Planning ends here until execution is requested.

## Rules

- A request to plan is not permission to implement or publish tickets.
- A blocking unknown must be resolved or explicitly block its dependent unit; do not pretend the whole future is known.
- Durable requirements avoid brittle file-level recipes; immediate work units may include checked paths, symbols, and commands.

## Complete when

The next consumer can act without inventing intent; blocked branches are identified.

Return or save plan, decision as needed under [artifact conventions](../../ARTIFACTS.md).

## Relevant detail

Read each applicable section before its step.

- [decomposition](references/decomposition.md).
- [migration](references/migration.md).
- [templates](SKILL.md#templates).

<a id="templates"></a>

## Templates

The smallest plan states Goal, Non-goals, Acceptance, Decisions, Work, and Verification. Requirements-only means the intended behavior is settled but implementation choices still block execution. Implementation-ready means each next unit has enough detail to start. A short plan can be a chat paragraph; a durable plan keeps WHAT and HOW separate in one file. Tests and manual acceptance are labeled by who can actually perform them. Reuse the project’s established template rather than overwrite its style.
