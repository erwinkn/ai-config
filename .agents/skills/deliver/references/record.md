# Record

Keep one chronological work-and-decision log per substantive task. Default path: docs/audits/<task>/decisions.tsv in the canonical worktree. The lead is the only writer. Parallel workers work elsewhere and return proposed entries with their artifacts; the lead records important choices without maintaining duplicate timelines.

Columns: id, time, phase, actor, decision, reason, evidence, outcome, status. Give entries stable ids. Record concise decision rationale, not every command, a transcript, or private reasoning. Time is observed event time when known; otherwise state that it is the recording time. Never backfill an invented event time. Evidence consists of exact revision/file/test/report pointers. Log meaningful forks, failed hypotheses, reverted attempts, accepted or dismissed review findings, changes to requirements, and verification boundaries as they occur.

Append corrections with the superseded entry id rather than silently changing the past. A log describes the work, not an idealized account of it. Keep secrets and unrelated personal or customer material out. Sanitize any published snapshot without changing its factual meaning; retain an explicit redaction note where necessary. An evaluator label from audit is a derived finding and does not become a second event history.

Before final readiness, audit reconciles the log and evidence. Publish the redacted canonical log and audit.md on the PR. Repository-hosted files are the default, so the artifact survives a temporary workspace; another explicitly agreed durable store is acceptable. Large raw traces remain outside git in the approved evidence store.

Pin the code revision assessed before adding audit-only files. After publication, required CI must describe the actual current PR head. Do not continuously rewrite the audit to contain its own new commit hash: identify the tested code revision and say what documentation-only commit followed. New semantic work or a relevant base change requires the affected audit and checks to be refreshed. A publication receipt may be a PR comment rather than another commit to record its own hash.


## Append an event

The optional [record helper](../../../scripts/record.py) appends one event with a stable ID and the recording timestamp. The lead is its exclusive writer. It is not a scheduler or concurrency mechanism. Supply real decision, reason, evidence, outcome, and status fields. Corrections append and identify the superseded row; never erase inconvenient attempts.

```bash
python3 "$STACK_ROOT/scripts/record.py" "$LOG"   --phase design --actor lead --decision 'Use an explicit lifecycle'   --reason 'Expiry and revocation differ' --evidence 'docs/plan.md#lifecycle'   --outcome 'Chosen; implementation pending' --status planned
```

Replace the example with this task's facts. A recording timestamp does not fabricate an earlier event time. Publish concise decision rationale, never raw private reasoning.
