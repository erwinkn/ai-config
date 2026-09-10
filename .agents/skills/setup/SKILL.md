---
name: "setup"
description: "/setup when installing the stack in a project, changing role model choices, repairing its verification recipe, or explicitly cleaning owned workspaces."
disable-model-invocation: true
---

# Setup

Manual setup keeps one-time project and host details out of every reusable skill.

## Assignment

lead.

Use the named agent definition for substantive delegated work. If you are already its assigned worker, execute this procedure directly; do not dispatch yourself again. Preserve the caller's endpoint and return mode. Read [shared rules](../principles/references/rules.md) and the relevant [principles](../principles/SKILL.md).

## Procedure

1. Inspect the host’s supported skill and agent fields, project conventions, existing commands, instructions, and verification tools.

2. Set each role’s model in its agent definition after checking availability. Install lead guidance into the main conversation through the host’s supported instructions; do not spawn an unnecessary management agent.

3. Record only missing project-specific commands and conventions in existing project docs; link rather than duplicate.

4. When needed, have implementer write a project-local verify-<project> recipe and verifier actually run it end-to-end.

5. Offer scoped changes to existing checks or cleanup only when requested; validate the resulting instructions and report what was installed.

## Rules

- No permission-bypass defaults, broad dependency installation, scheduler implementation, or registry service.
- Never delete untracked work merely because it is untracked; check ownership and obtain needed authority.
- An unavailable cross-provider model assignment is unresolved setup, not permission to pretend that model ran.

## Complete when

The intended setup or repair is verified, with missing capabilities explicit.

## Relevant detail

Read each applicable section before its step.

- [project](SKILL.md#project).
- [verification](references/verification.md).
- [cleanup](references/cleanup.md).

<a id="project"></a>

## Project

Inspect the project’s existing commands, docs, tracker, language conventions, and permission setup. Record only missing non-obvious conventions in their existing homes. Keep a small main-session pointer to the canonical lead/rules when the host needs it; avoid copying the whole stack into root instructions. Set native model/tool fields using supported values. A human-only credential or dashboard step gets a precise safe handoff, optionally a project script; it is not another framework layer.
