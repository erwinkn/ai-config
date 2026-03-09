---
name: code-quality-ultimate
description: Unified review-and-fix pass for cleanup and design hardening. Use when the user explicitly asks for cleanup, simplification, or a quality pass after implementation.
metadata:
  argument-hint: "[review-only] <additional-focus>"
---

# Code Quality Ultimate

Run one cleanup and design-hardening pass over the current change set. Apply fixes that clearly preserve the supported contract directly unless the user asked for `review-only`, in which case produce findings without edits. If extra arguments are supplied, treat them as additional focus for the entire pass.

## Design Bar

End state: avoid duplicate paths for the same concern, keep one obvious owner for state and lifecycle, and keep interfaces direct.

Apply this order:
1. Prefer existing abstractions when they are the right fit.
2. If the change conceptually belongs to an existing abstraction, extend or refactor that abstraction.
3. Otherwise, implement the change separately and update surrounding abstractions only as needed to keep the system coherent.

Do not force poor-fit reuse just to avoid new code. Avoid hacks, bolt-ons, monkey patching, and overly verbose interfaces. Preserve supported behavior unless the user explicitly asks for a behavior change.

## Workflow

### 1. Scope the change

- In a dirty worktree, start with `git status --short` to identify task-related staged, unstaged, and untracked files.
- Review only those task-related paths. Use `git diff -- <paths>` for unstaged changes and `git diff HEAD -- <paths>` when you need staged and unstaged changes together.
- For untracked task files, inspect the files directly; they will not appear in `git diff HEAD` by default.
- If there is no diff, review the files the user named or the files you changed for this task in the current conversation. If there is still no clear scope, ask the user to name the files or provide a diff.
- Trace the relevant execution path through the system: how input enters, where the core logic lives, and where the result is persisted, returned, or rendered.

### 2. Establish the contract and validation state

- Before applying fixes, define the supported contract from the strongest available evidence: explicit user requirements, current tests, types, docs, and active call sites. If that evidence conflicts or is incomplete, ask the user before making removals or behavior changes that depend on it.
- Record whether you have personally run lint, type checks, automated tests, and any applicable interactive checks. Interactive checks mean exercising the relevant user-facing flow when the changed path has one; otherwise report them as not applicable.
- If you have not run those checks yet, keep changes structurally conservative and defer removals that depend on proving a path obsolete.

### 3. Review the change

Check the diff and the call sites and integration points traced in step 1 for:

- `Reuse`: keep existing helpers and abstractions when the fit is clean; extend or refactor close-but-incomplete abstractions instead of adding adapters or side channels.
- `Local quality`: remove redundant state, parameter sprawl, copy-paste variants, and internal logic that relies on magic strings instead of explicit contracts.
- `Efficiency`: remove repeated work, unnecessary pre-checks, leaks, overly broad reads, and extra work in startup, request, render, or tight-loop paths.
- `Architecture`: keep one clear path per concern, remove wrappers that only forward calls, and place state and lifecycle ownership with one obvious owner.
- `Types and contracts`: replace avoidable dynamic patterns with explicit contracts; keep validation at real boundaries and remove internal defensive checks only when the invariant is enforced by the design, types, or tests. Do not weaken boundary or security checks.
- `Brittleness`: fix assumptions that can fail under actual usage and make error handling expose contract or ordering bugs instead of masking them.
- `Validation coverage`: confirm lint, type checks, automated tests, and any applicable interactive checks cover the changed path; strengthen coverage when an unverified path remains.
- Keep the blast radius tight: stay within the current diff and directly related call sites unless expanding the scope is required for correctness.

## Fixing Rules

- Review first, apply fixes second, then report the final outcome.
- Tie-break rule: when architectural cleanup conflicts with behavior preservation or a tight blast radius, prefer preserving behavior and keeping the change scoped.
- Fix issues directly when the fix does not alter the supported contract.
- Refactor or replace poor-fit abstractions only when the structural problem is inside the current diff or directly blocks a correct fix.
- Do not add fallback paths, transitional interfaces, or superseded code unless they are required to preserve the supported contract. Remove existing ones only when they are clearly outside that contract or the user explicitly wants a hard cut. Otherwise, leave them in place and report them as cleanup candidates.
- Only add concurrency or performance-oriented restructuring when the hotspot is measured or clearly user-visible.
- Keep interfaces as small and direct as the design allows.
- If a simplification would materially change behavior, stop and ask the user before applying it.

## Verification

If you edited code, re-run the affected lint, type-check, and test commands, plus any applicable interactive checks. If required checks cannot run, do not broaden the change beyond clearly safe, contract-preserving local cleanup. If the pass was `review-only`, report which checks were already run and which were not run; do not claim reruns you did not perform.

## Report

Severity rubric:
- `High`: likely behavior regression, data loss, security issue, or invalid verification
- `Medium`: maintainability, performance, or coverage issue that weakens the result
- `Low`: clarity or polish issue with limited practical risk

Report in this order:
1. findings first, ordered by severity, with concrete file references when relevant
2. edits applied, if any, and why they improved reuse, design coherence, or efficiency
3. verification: exact commands run, pass/fail results, and skipped checks with reasons
4. residual risks or testing gaps

If no material issues are found, say `No material findings`.
