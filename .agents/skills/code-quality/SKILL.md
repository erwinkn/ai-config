---
name: code-quality
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

### 3. Launch review agents in parallel

Obtain the full diff from step 1. Use the `ai-agents` skill to delegate five review agents concurrently — launch all five in a single message so they run in parallel. Pass each agent the full diff and the traced execution path so it has complete context.

**Agent routing:** use a different AI backend from your own to maximize decorrelation.
- If you are **Claude** (`claude`): delegate to **Codex** (`codex`) subagents.
- If you are **Codex** (`codex`): delegate to **Claude** (`claude`) subagents.
- If neither alternate CLI is available, fall back to your own CLI's headless mode (e.g. `claude -p`, `codex --quiet`).

Each agent runs in read-only / plan mode and returns structured findings only — no edits.

#### Agent 1: Reuse Review

Prompt the agent to review the diff for reuse opportunities:

1. Search for existing utilities and helpers that could replace newly written code — common locations are utility directories, shared modules, and files adjacent to the changed ones.
2. Flag any new function that duplicates existing functionality and suggest the existing function instead.
3. Flag inline logic that could use an existing utility — hand-rolled string manipulation, manual path handling, custom environment checks, ad-hoc type guards, and similar patterns.
4. Check whether the change conceptually belongs to an existing abstraction that should be extended rather than bypassed.

Return contract: bullet list of findings with file paths and line numbers, or "No findings".

#### Agent 2: Quality & Architecture Review

Prompt the agent to review the diff for quality and architecture issues:

1. **Redundant state**: state that duplicates existing state, cached values that could be derived, observers/effects that could be direct calls.
2. **Parameter sprawl**: adding new parameters to a function instead of generalizing or restructuring existing ones.
3. **Copy-paste with slight variation**: near-duplicate code blocks that should be unified with a shared abstraction.
4. **Leaky abstractions**: exposing internal details that should be encapsulated, or breaking existing abstraction boundaries.
5. **Stringly-typed code**: using raw strings where constants, enums (string unions), or branded types already exist in the codebase — search the codebase for existing type-safe alternatives.
6. **Architecture**: multiple paths for the same concern, wrappers that only forward calls, unclear state or lifecycle ownership.
7. **Types and contracts**: avoidable dynamic patterns that should use explicit contracts; internal defensive checks where the invariant is already enforced by design, types, or tests.
8. **Brittleness**: assumptions that can fail under actual usage; error handling that masks contract or ordering bugs instead of exposing them.

Return contract: bullet list of findings with severity (High/Medium/Low), file paths, and line numbers, or "No findings".

#### Agent 3: Efficiency Review

Prompt the agent to review the diff for efficiency:

1. **Unnecessary work**: redundant computations, repeated file reads, duplicate network/API calls, N+1 query patterns.
2. **Missed concurrency**: independent operations run sequentially when they could run in parallel.
3. **Hot-path bloat**: new blocking work added to startup, per-request, per-render, or tight-loop hot paths.
4. **TOCTOU anti-pattern**: pre-checking file/resource existence before operating — operate directly and handle the error instead.
5. **Memory**: unbounded data structures, missing cleanup, event listener leaks.
6. **Overly broad operations**: reading entire files when only a portion is needed, loading all items when filtering for one.

Return contract: bullet list of findings with severity (High/Medium/Low), file paths, and line numbers, or "No findings".

#### Agent 4: Security Review

Prompt the agent to review the diff for security vulnerabilities:

1. **Injection**: SQL injection, command injection, template injection, XSS, and any other context where user-controlled input reaches an interpreter or renderer without sanitization or parameterization.
2. **Auth and access control**: missing or bypassed authentication checks, broken authorization (e.g. accessing resources by ID without ownership verification), privilege escalation paths.
3. **Secrets and credentials**: API keys, tokens, passwords, or connection strings hardcoded in the diff or committed to version control; insecure storage of sensitive data.
4. **Insecure defaults**: permissive CORS, disabled CSRF protection, overly broad file permissions, debug modes left on, missing rate limiting on sensitive endpoints.
5. **Path traversal and file access**: user-controlled paths used in file operations without canonicalization or jail; symlink-following where it should not occur.
6. **Unsafe deserialization**: deserializing untrusted input with formats that allow code execution (pickle, YAML `load`, Java serialization) instead of safe alternatives.
7. **Cryptography misuse**: weak algorithms, hardcoded IVs/salts, rolling custom crypto, using encryption where hashing is needed or vice versa.
8. **Dependency surface**: newly added dependencies with known CVEs, or pinning to vulnerable versions.

Return contract: bullet list of findings with severity (Critical/High/Medium/Low), file paths, line numbers, and CWE ID where applicable, or "No findings".

#### Agent 5: Test Quality Review

Prompt the agent to review the diff and the associated test files for test quality, correctness, and coverage:

1. **Missing coverage**: new or changed code paths, branches, and edge cases that have no corresponding test. Pay special attention to error paths, boundary conditions, empty/null inputs, and off-by-one scenarios.
2. **Correctness gaps**: tests that pass but do not actually verify the behavior they claim to — weak assertions (e.g. only checking truthiness instead of the specific value), assertions on the wrong variable, tests that would still pass if the feature were deleted.
3. **Duplicate tests**: tests that exercise the exact same code path with the same inputs and assertions as another test, adding maintenance cost without additional coverage signal.
4. **Overtly obvious tests**: tests that assert only trivially true outcomes — getters return what was set, constructors produce non-null objects, identity transformations — without testing meaningful behavior or invariants.
5. **Useless mocks**: mocks that replace so much of the system under test that the test only verifies the mock wiring rather than real behavior; mocks of pure functions or simple value objects that could be used directly.
6. **Mock fidelity**: mocks whose return values or behavior have drifted from the real implementation, making the test pass against a contract the real code no longer satisfies.
7. **Brittle test setup**: tests coupled to incidental details (exact string output, insertion order, timestamps, random values) that will break on unrelated changes; tests that depend on global state or execution order.
8. **Missing edge-case and boundary tests**: off-by-one errors, empty collections, maximum/minimum values, unicode/special characters, concurrent access, and resource exhaustion scenarios relevant to the changed code.

Return contract: bullet list of findings with severity (High/Medium/Low), file paths, line numbers, and a short rationale for each, or "No findings".

### 4. Aggregate and fix

Wait for all five agents to complete. Aggregate their findings, deduplicate overlapping items, and order by severity. Security findings at Critical or High severity take priority over all other fixes.

If the user asked for `review-only`, skip to the Report section.

Otherwise, fix each valid finding directly, applying the fixing rules below. If a finding is a false positive or not worth addressing, note it and move on — do not argue with the finding, just skip it.

## Fixing Rules

- Review first, apply fixes second, then report the final outcome.
- Tie-break rule: when architectural cleanup conflicts with behavior preservation or a tight blast radius, prefer preserving behavior and keeping the change scoped.
- Fix issues directly when the fix does not alter the supported contract.
- Refactor or replace poor-fit abstractions only when the structural problem is inside the current diff or directly blocks a correct fix.
- Do not add fallback paths, transitional interfaces, or superseded code unless they are required to preserve the supported contract. Remove existing ones only when they are clearly outside that contract or the user explicitly wants a hard cut. Otherwise, leave them in place and report them as cleanup candidates.
- **Favor parallel over sequential**: when independent operations are currently run sequentially, restructure them to run concurrently (e.g. `Promise.all`, parallel subprocess spawning, concurrent goroutines) unless ordering is required by the contract.
- **Eliminate TOCTOU checks**: when code pre-checks file/resource existence before operating on it, remove the existence check, operate directly, and handle the resulting error.
- **Cap unbounded structures**: when a data structure can grow without bound (caches, event listener registrations, accumulated buffers), add size limits, eviction, or cleanup as appropriate.
- **Collapse N+1 patterns**: when code issues one query/call per item in a collection, batch the operation into a single call or a bounded number of calls.
- Only add concurrency or performance-oriented restructuring when the hotspot is measured, clearly user-visible, or flagged by the efficiency review agent.
- **Fix security issues immediately**: injection, auth bypasses, and hardcoded secrets are never deferred. Use parameterized queries, proper escaping, and secret-management patterns already present in the codebase. Do not weaken boundary or security checks to simplify code.
- **Delete worthless tests, strengthen weak ones**: remove duplicate tests, overtly obvious tests, and tests whose mocks replace all real behavior. Replace weak assertions with specific value checks. Do not add tests for trivially true invariants.
- **Replace stale mocks**: when a mock's contract has drifted from the real implementation, update the mock to match reality or remove it in favor of the real dependency when feasible.
- **Add missing edge-case tests**: when the changed code introduces branches or boundary conditions with no test coverage, add focused tests for those paths — prioritize error paths, empty/null inputs, and off-by-one boundaries.
- Keep interfaces as small and direct as the design allows.
- If a simplification would materially change behavior, stop and ask the user before applying it.

## Verification

If you edited code, re-run the affected lint, type-check, and test commands, plus any applicable interactive checks. If required checks cannot run, do not broaden the change beyond clearly safe, contract-preserving local cleanup. If the pass was `review-only`, report which checks were already run and which were not run; do not claim reruns you did not perform.

## Report

Severity rubric:
- `Critical`: exploitable security vulnerability, credential exposure, or auth bypass
- `High`: likely behavior regression, data loss, non-exploitable security weakness, or invalid verification
- `Medium`: maintainability, performance, test quality, or coverage issue that weakens the result
- `Low`: clarity or polish issue with limited practical risk

Report in this order:
1. findings first, ordered by severity, with concrete file references when relevant
2. edits applied, if any, and why they improved reuse, design coherence, or efficiency
3. verification: exact commands run, pass/fail results, and skipped checks with reasons
4. residual risks or testing gaps

If no material issues are found, say `No material findings`.
