---
name: "ship"
description: "Use when an active delivery needs commits, pushes, or PR creation/updates, or the user explicitly requests a publication step; merging, auto-merge, and deployment need explicit additional authority."
---

# Ship

One publication playbook supports explicit endpoints. Opening a PR is not synonymous with merging or deploying.

## Assignment

lead.

Use the named agent definition for substantive delegated work. If you are already its assigned worker, execute this procedure directly; do not dispatch yourself again. Preserve the caller's endpoint and return mode. Read [shared rules](../principles/references/rules.md) and the relevant [principles](../principles/SKILL.md).

## Procedure

1. Resolve the action and target from the caller’s authority. Full delivery supplies commit, push, and PR authorization by default; a local-only override narrows it.

2. Inspect actual tree and remote state, preserve unrelated work, and require the project’s evidence for the intended publication stage.

3. Create focused commits and a reviewer-oriented PR description. A draft may hold in-progress work; the final delivery endpoint is a ready PR with required checks and approvals satisfied.

4. Publish the work log and confidence-graded decision audit in repository-hosted PR artifacts by default, after checking for secrets and private content. Link exact artifacts and the reviewed code revision; another agreed durable artifact store is acceptable.

5. Perform only the authorized publication actions and verify remote state. Return to the caller; ship does not recursively start another delivery or babysit. A direct merge request uses the stack safety procedure and fresh applicable checks.

## Rules

- Model-invokable means the model may recognize an authorized shipping request, not invent authorization.
- Do not automatically merge, deploy, or post promotion copy after opening a PR.
- Preserve the rationale for necessary compatibility and recheck changed-base behavior, even for an unchanged patch.

## Complete when

The exact authorized action and artifact publication are confirmed; a full delivery caller then continues to its merge-ready endpoint rather than stopping at the URL.

## Relevant detail

Read each applicable section before its step.

- [publication](SKILL.md#publication).
- [description](SKILL.md#description).
- [stacks](references/stacks.md).

<a id="publication"></a>

## Publication

Starting full delivery supplies authority for focused commits, pushes, PR creation/updates, and feedback resolution up to merge-ready, unless narrowed. ship performs only the caller’s exact step and returns; it does not create a second watch loop. Preserve other staged work, check remote identity and current state, and verify external writes. A draft is valid while unfinished. Neither readiness nor the word ship inside a delivery procedure grants merge, auto-merge, deployment, original-PR overwrite, or unrelated external-message authority.

<a id="description"></a>

## Description

The PR body explains intent, structural choices, scope, compatibility and operational consequences, and what was actually verified. Include a concise Decision audit section with durable links to the canonical log snapshot and audit.md, the reviewed code revision, and unresolved risks. The full evidence trail is a linked artifact rather than a long PR-body dump. Before final readiness, verify the links and current required checks. A code SHA or tree reviewed before an audit-only commit stays explicitly identified; do not invent a self-referential final SHA inside that commit.
