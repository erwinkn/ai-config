---
name: decision-audit
description: Pre-merge audit of the choices made during implementation, not the code itself. Use before any commit, PR, or merge of agent-implemented work, or when the user says "audit your choices", "which decisions did you make", "pride gate", or asks whether you stand behind the work.
metadata:
  argument-hint: "[branch|diff-ref] (defaults to work done in this session)"
---

# Decision Audit

The user does not review your diff. They review your decisions. Your job here is to make that possible.

The premise: given a concrete, well-specified plan, implementation is reliable — the code lands as specified, no matter how large. Where things go wrong is everywhere the spec was silent and you decided something yourself. Those decisions are the entire attack surface for codebase degradation, and they are invisible in a diff unless someone reads thousands of lines. So instead of the diff, you produce the complete list of decisions you made, flagged by confidence, and the user triages that list.

This audit is a gate. Work is not done, and success must not be declared, until the audit has been produced and the user has triaged it.

## When to run

- Before any commit, PR, or merge of work you implemented — as the final step, after tests pass.
- When the user asks "which choices did you make?", "are you proud of this?", or invokes this skill directly.
- On someone else's branch: reconstruct the decisions from the diff and commit history, then audit those the same way.

## Step 1: Enumerate every decision that was yours

Go back through the work — the conversation, your plan, the diff — and list every point where the spec, the plan, or the user's request did not fully determine what you did, and you chose. Not a summary of what you built; a list of forks in the road where you picked a branch.

Hunt specifically for the high-risk species:

- **Symptom fixes that happened to work.** You changed something, the failing case passed, and you declared victory — but the change addresses this instance, not the underlying cause. (Doubling a buffer "fixes" the crash at hand while the real bug stays dormant.) If you cannot articulate *why* the fix is general, it goes on the list.
- **Interpretations of ambiguity.** The request could have meant two things; you picked one.
- **Silently narrowed or expanded scope.** Edge cases you decided were out of scope, features you added because they "seemed wanted", inputs you decided not to handle.
- **Magic values and thresholds.** Any constant, size, timeout, or limit you invented rather than derived.
- **Structural choices.** Where you put things, what you abstracted, what you duplicated, which existing pattern you extended vs. bypassed.
- **Workarounds and special cases.** Any `if` that exists to route around a problem rather than express the domain.
- **Errors handled by swallowing.** Anywhere you caught, defaulted, or retried instead of surfacing.
- **Test decisions.** What you chose not to test, and any test you weakened or adjusted to make pass.
- **Things you punted.** Anything you noticed, thought "not now", and moved past without telling the user.

Completeness beats brevity here. A decision you omit is a decision the user cannot catch — the one you're tempted to leave off the list is precisely the one that belongs on it.

## Step 2: Report against interest

For each decision, state:

1. **The decision** — what you chose, in one sentence.
2. **What else you could have done** — the road not taken.
3. **Confidence** — high / medium / low, judged honestly.
4. **How it would bite** — the concrete scenario in which this choice turns out wrong.

Order the list least-confident first. Do not defend choices; disclose them. A decision you feel the urge to justify at length is a low-confidence decision — mark it as such and let the user decide. Never round a "it worked on the case at hand" up to "it's correct".

## Step 3: The pride gate

End with a direct verdict: **are you proud of this branch, and would you stand behind every commit in it?**

Answer without ego and without diplomacy. If the honest answer is "mostly, except…", say exactly that and name the exceptions — they are usually items from Step 2 that deserve to be fixed rather than merely disclosed. "Proud" means: nothing in here relies on coincidence, nothing is quietly narrower than what was asked, and you'd make every one of these choices again with full information. If any of that fails, the verdict is not yes.

A "no" or "yes, except" verdict is a good outcome. It's the audit doing its job. Declaring unqualified success on work with dormant issues is the failure mode this entire skill exists to prevent.

## Step 4: Triage and correct

Stop and let the user triage — do not merge, commit, or declare completion on their behalf. When they flag a decision as wrong, treat the correction as a spec update: fix the root cause properly, don't patch the patch. After corrections, re-run the audit on the corrected work (it will be short) so the loop closes on a clean pass.
