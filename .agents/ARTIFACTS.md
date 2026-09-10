# Artifacts

Use existing project locations where appropriate. Save what continuity or review needs; a normal response does not automatically become a document. Never put secrets in shared artifacts.

## glossary

Domain terms, relationships, states, and invariants; not file listings or implementation plans.

Location: CONTEXT.md; add CONTEXT-MAP.md only when multiple genuine contexts exist.

Produced by model. Used by research, design, plan, implement, review.

## decision

A consequential choice, alternatives, rationale, and conditions for reconsidering it.

Location: docs/decisions/<topic>.md; reuse existing ADR conventions. Create only for costly-to-reverse, non-obvious tradeoffs.

Produced by model or design. Used by plan, implement, review.

## research

Relevant facts, sources, null results, hypotheses, and unresolved evidence gaps.

Location: A short note in the project’s existing research location. Chat is sufficient for disposable answers.

Produced by research or diagnose. Used by lead, design, plan, implement.

## plan

The agreed outcome, non-goals, acceptance criteria, selected design, and next executable units with dependencies.

Location: One plan file with clear requirements and implementation sections. Tickets are views or linked units of that plan, not a rival specification.

Produced by plan. Used by deliver, implement, review, verify.

## change

Implementation, tests, and reusable helpers. A rewrite candidate is a separate change against a frozen target base; the original PR remains recoverable until authorized replacement.

Location: The working tree, patch, commits, and PR. Do not invent a Markdown wrapper for every code change.

Produced by implement, simplify, or manual rewrite. Used by review, verify, integrate, ship.

## findings

Evidence-backed code-review, triage, or decision-audit findings. For an audit, each substantive decision has evidence pointers, an evidential-support label, impact, and any unresolved risk.

Location: Code findings may be inline or PR threads. A delivery decision audit is a durable PR artifact, normally docs/audits/<task>/audit.md, linked beside the canonical log; it records the exact code revision assessed.

Produced by review, triage, or audit. Used by lead, integrate, deliver, babysit, human PR review.

## evidence

Claim, expected result, tested revision/environment, procedure run, observation, artifacts, and limitations.

Location: Usually a section in the plan or PR plus logs/screenshots. A dedicated file is earned by reuse or complexity.

Produced by verify or test. Used by lead, review, ship, handoff.

## handoff

Goal, settled decisions, canonical log pointer, exact current code/PR/worktree state, evidence, completed versus pending work, live-worker ownership, and the precise next action.

Location: Use a durable task location and reference the canonical decision log instead of copying its history. Reconcile saved claims with current reality before continuing.

Produced by handoff. Used by a new or resumed session.

## learning

Verified, non-obvious reasoning not already recoverable from the final code, tests, or docs.

Location: docs/learnings/<topic>.md or the project’s existing solutions directory. Zero new notes is a valid outcome.

Produced by learn. Used by research and subsequent work.

## record

One canonical chronological work-and-decision log for each substantive delivery, written as work happens. Includes meaningful choices, their concise reasons, failed or reverted attempts, verification results, accepted or rejected review feedback, and evidence pointers. Not a transcript or private-reasoning record.

Location: Default docs/audits/<task>/decisions.tsv in the canonical worktree; reuse an existing appropriate repository convention. One writer. Publish a redacted snapshot together with docs/audits/<task>/audit.md on the PR; audit is findings derived from the log, not a second event history.

Produced by lead during deliver, rewrite, optimize, compound, or evaluate; workers return entries to the lead. Used by auditor, handoff, human PR review.
