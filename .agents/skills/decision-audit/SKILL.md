---
name: decision-audit
description: Log your decisions as you make them, then audit them before handing work back. Use when you start non-trivial implementation work, before you commit, open a PR, or merge agent-written work, or when the user asks which choices you made.
metadata:
  argument-hint: "[branch|diff-ref] (defaults to work done in this session)"
---

# Decision audit

The user does not review your diff. They review your decisions.

A clear plan gets implemented reliably, whatever its size. Problems come from the places where the plan was silent and you chose. Those choices are invisible in a diff, so you log each one when you make it, and before handing back you audit the log. The log is written in the moment because recall at the end is unreliable: the small choices are forgotten, low confidence turns into high once tests pass, and the decision you leave out is the one that mattered.

## Record while you work

Log a row at each fork where the request, the plan, or the spec did not decide for you. Write it when you decide, before you move on. The risky kinds:

- **Symptom fixes.** The failing case passes, but you cannot say why the fix is general. Doubling a buffer stops this crash and leaves the real bug in place.
- **Interpretations.** The request could mean two things and you picked one.
- **Scope changes.** Edge cases you left out, features you added because they seemed wanted, inputs you do not handle.
- **Invented values.** A constant, size, timeout, or limit you chose rather than derived.
- **Structure.** Where code goes, what you abstracted or duplicated, which existing pattern you extended or bypassed.
- **Workarounds.** An `if` that routes around a problem instead of expressing the domain.
- **Swallowed errors.** A catch, default, or retry where the error could have surfaced.
- **Tests.** What you chose not to test, and any test you weakened or changed to make it pass.
- **Punts.** Something you noticed and left for later.

Do not log steps the spec dictates or choices with one obvious answer.

Run `scripts/decision-log.sh` from this skill's directory by its full path, with the repository you work in as the current directory. The script logs to the repository of the current directory.

```sh
scripts/decision-log.sh add <decision> <instead> <confidence> <why> <evidence>
scripts/decision-log.sh show
```

| Column | Content |
| --- | --- |
| decision | What you chose, in one line. |
| instead | The main option you did not take. |
| confidence | `high`, `medium`, or `low`, as you judge it now. |
| why | The reason, in plain words. |
| evidence | A pointer, not prose: `file:line`, a commit, a test run, a PR. |

```
ts                    decision                           instead                        confidence  why                                           evidence
2026-09-24T09:02:00Z  cap sync retries at 3              make it configurable           low         guessed; no data on failure rates             src/sync.ts:88
2026-09-24T09:40:00Z  derive cart total from line items  keep the cache, invalidate it  high        three review findings shared the stale cache  commit 3a9f1c2
```

The script adds the timestamp. The log is per branch and lives in the Git directory, so Git never tracks it; `decision-log.sh path` prints where.

The log is append-only. When a decision turns out wrong, add a row that starts with `supersedes <ts>:` and says what you do now. Do not edit or delete rows.

Other skills write to this log instead of keeping their own. `autoreview` logs each root-cause fix and each rejected finding here.

## Audit before handing back

Run the audit before you commit, open a PR, or merge work you implemented, and when the user asks for it.

1. **Read the log.** When there is no log, reconstruct the decisions from the conversation and the diff, and say that the audit comes from recall. On someone else's branch, reconstruct them from the diff and the commit history.
2. **Check it against the diff.** Every change that the plan did not dictate must trace to a row. A change with no row is a decision that went unlogged: add the row now and mark it in the report as found late.
3. **Report least confident first.** For each decision give what you chose, what you could have done instead, the confidence, and how it would go wrong: the concrete case in which this choice turns out to be a mistake. Disclose, do not defend. When you want to justify a choice at length, its confidence is low.
4. **Answer the pride question.** Are you proud of this work, and would you stand behind every change in it? Proud means nothing relies on coincidence, nothing is quietly narrower than what was asked, and you would make every choice again with full information. When the answer is "yes, except", name the exceptions. They usually deserve a fix, not only a disclosure.
5. **Stop for triage.** Do not commit, merge, or declare the work done until the user has read the report. When they flag a decision as wrong, fix the root cause, log the correction as a superseding row, and run the audit again. It will be short.
