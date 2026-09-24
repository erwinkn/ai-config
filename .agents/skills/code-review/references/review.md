# Code review reference

Review a change made by another engineer. Report findings. Do not edit code.

Project review guidelines override this rubric. Look for `REVIEW_GUIDELINES.md` in the repository root or the nearest ancestor directory. Apply extra instructions from the user's request too.

## Pick the review target

| The user asks for | Mode | What to review |
| --- | --- | --- |
| "review my changes", "review uncommitted" | uncommitted | staged, unstaged, and untracked files |
| "review this branch", "review against main" | branch | diff from the merge base with a base branch |
| "review commit abc123" | commit | one commit |
| "review PR 123", a GitHub PR URL | pr | the pull request diff |
| "review src docs" | folder | snapshot of the paths, not a diff |

When the user does not name a target, inspect the repository and choose. Prefer uncommitted changes when the worktree is dirty. Otherwise compare the current branch with its base. Ask only when two modes are equally likely.

## Prepare the change

Run `scripts/review-context.sh` from the `code-review` skill directory. It resolves the target, prints the changed files, and prints the next command.

```sh
scripts/review-context.sh uncommitted
scripts/review-context.sh branch <base-ref>
scripts/review-context.sh commit <sha>
scripts/review-context.sh pr <ref>
scripts/review-context.sh folder <path>...
```

The same steps, if you run them directly:

**uncommitted**
1. `git status --short`
2. `git diff` for unstaged changes and `git diff --cached` for staged changes.
3. Read every untracked file named in the status output.

**branch**
1. Resolve the base ref. When the named branch exists, prefer its upstream: `git rev-parse --abbrev-ref <ref>@{upstream}`.
2. Find the merge base: `git merge-base HEAD <base>`. Use `origin/<ref>` when the local branch is absent.
3. `git diff <merge-base-sha>`. A diff against the branch tip directly mixes in unrelated base changes.
4. Stop and report when no merge base exists.

**commit**
- `git show <sha>` for a single commit. For a merge commit, diff the first parent.
- Check that the subject line matches the commit the user named.

**pr**
1. `gh pr view <ref> --json baseRefName,title,headRefName` and `gh pr checkout <ref>`.
2. Stop when `gh` is missing, unauthenticated, or the worktree has changes to tracked files. Ask the user to commit or stash first. Untracked files are safe.
3. Find the merge base between the PR head and the base branch. Try `origin/<base>` then `<base>`.
4. `git diff <merge-base-sha>`.

**folder**
- Read the files under each path. This is a snapshot review, not a diff. Do not report pre-existing issues as new findings.

## Thermo-nuclear mode

When the request asks for a thermo-nuclear review, also read [thermo-nuclear.md](thermo-nuclear.md) and apply it on top of this rubric. It is an extremely strict review of structure and maintainability. The review target from this file replaces its "current branch's changes", you still do not edit code, and you still return the handoff below. Tag its presumptive blockers P1 or higher.

## Determine what to flag

Flag issues that:

- Affect accuracy, performance, security, or maintainability.
- Are discrete and actionable. One issue per finding.
- Do not demand more rigor than the rest of the codebase.
- Were introduced by this change, not present before it.
- The author would likely fix if they knew about them.
- Do not depend on unstated assumptions about the codebase or the author's intent.
- Have a provable effect on other parts. Name the affected parts.
- Are not clearly intentional changes.
- Treat untrusted user input carefully. See the rules below.
- Silently recover from local errors (parsing, I/O, network fallbacks) without a boundary-level reason.
- Violate the clean-code rules below.
- Conflict with the fail-fast rules below.
- Increase operational risk or on-call work. Missing back pressure handling is a finding.
- Match on error messages instead of stable error codes or identifiers.

## Clean code

1. A new function that duplicates existing functionality is a finding. Name the existing implementation.
2. A one-off helper that adds indirection without clarity or reuse is a finding, for example `isRecord` or `asString`.
3. An abstraction with no concrete need in this change is a finding. This includes wrappers for possible future use.
4. A defensive check or fallback that hides a programming error is a finding, especially when callers already guarantee the condition.

## Untrusted input

1. An open redirect must go only to trusted domains, for example `?next_page=...`.
2. Flag SQL that is not parameterized.
3. In systems with user-supplied URL input, protect HTTP fetches from access to local resources. Intercept the DNS resolver.
4. Escape, do not sanitize, when you have the option. HTML escaping is an example.

## Comment guidelines

1. Explain why the issue is a problem.
2. Match the wording to the severity. Do not exaggerate.
3. Keep each comment to one paragraph at most.
4. Keep code snippets under 3 lines, as inline code or a code block.
5. Use ` ```suggestion ` blocks only for concrete replacement code. Keep the exact leading whitespace and put no commentary inside the block.
6. State the scenario or environment where the issue occurs.
7. Use a matter-of-fact tone.
8. Write for quick comprehension, without close reading.
9. Avoid praise and filler phrases.

## Fail-fast error handling

Default to fail-fast behavior for new or changed error handling.

1. For every new or changed `try/catch`, name what can fail and why local handling is correct at that exact layer.
2. Prefer propagation over local recovery. Rethrow with context when the current scope cannot fully recover while preserving correctness.
3. Flag catch blocks that hide failure signals. Examples: return `null`, `[]`, or `false`; swallow a JSON parse failure; log and continue; claim "best effort".
4. JSON parsing and decoding must fail loudly by default. A quiet fallback needs an explicit compatibility requirement and tested behavior.
5. Boundary handlers (HTTP routes, CLI entrypoints, supervisors) may translate errors, but must not report success or degrade silently.
6. A catch block that exists only to satisfy lint rules is a bug.
7. When you are not sure, prefer a fast failure over silent degradation.

## Priorities

Tag each finding in its title:

- `[P0]` Drop everything. Blocks release or operations. Use only for issues that hold for all inputs.
- `[P1]` Urgent. Fix in the next cycle.
- `[P2]` Normal. Fix eventually.
- `[P3]` Low. Nice to have.

## Handoff format

Return these sections in this order. The caller uses the handoff to act on the findings later, so keep every actionable item.

### Review Scope

What was reviewed: paths, changes, and scope.

### Verdict

`correct` when there are no blocking issues, `needs attention` when there are.

### Findings

List every qualifying finding, not only the first one. For each finding:

- Priority tag and short title.
- Location as `path/to/file.ext:line`.
- Why it matters. Keep it brief.
- What should change. Keep it brief and actionable.

### Fix Queue

An ordered implementation checklist, highest priority first.

### Constraints & Preferences

Any constraints or preferences from the review. Write `(none)` when there are none.

### Human Reviewer Callouts (Non-Blocking)

Include only the callouts that apply. Use the bold labels exactly as written:

- **This change adds a database migration:** <files/details>
- **This change introduces a new dependency:** <package(s)/details>
- **This change changes a dependency (or the lockfile):** <files/package(s)/details>
- **This change modifies auth/permission behavior:** <what changed and where>
- **This change introduces backwards-incompatible public schema/API/contract changes:** <what changed and where>
- **This change includes irreversible or destructive operations:** <operation and scope>
- **This change adds or removes feature flags:** <flags changed. Call out the re-use of dormant feature flags.>
- **This change changes configuration defaults:** <config var changed>

Callout rules:

1. These callouts inform a human reviewer. They are not fix items.
2. Do not repeat them in the findings unless they contain a separate defect.
3. These callouts alone must not change the verdict.
4. Write `- (none)` when no callout applies.

## Handoff rules

1. Findings must reference locations that overlap the change. Do not flag pre-existing code.
2. Keep line references short. Pick the most relevant subrange under 5 to 10 lines.
3. Ignore trivial style issues unless they obscure meaning or break a documented standard.
4. Do not write a full fix. Short suggestion blocks are allowed.
5. When no findings qualify, say the code looks good and give an empty fix queue.
6. Preserve exact file paths, function names, and error messages where available.
