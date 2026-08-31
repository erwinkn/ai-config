### Opening a PR

Invoked at the end of every other playbook.

**Worktree.** Work from a git worktree off main; subagents inherit it. Multiple `Task` calls on the same branch each get their own worktree, or `git fetch && git reset --hard origin/<branch>` between them. Dirty branch with unrelated work: patch out, fresh worktree, apply. Snarled worktree: reset from main, redo minimally.

**Commits.** Commit liberally; rebase into small, ordered commits before opening PRs. Each commit is a future PR: landable, ordered to tell the story. Amend when the fix belongs in a just-made commit; new commit when separable.

**PRs.** The **deslop** skill on the diff before commit; the **no-comments** skill before review; apply the **unslop** skill to the PR description and commit bodies. Small PRs, 5 narrow over 1 fat; stack follow-ups, branch off main only for genuinely independent work. For stacked PRs, use GitHub native `gh stack` + API, same-repo only. Cross-fork stacks are not supported. `gh pr view <number>` before referencing PR status. Rebase on `main` before substantial stack work. No `## Summary` / `## Test plan` boilerplate on small PRs; commit bodies don't restate the subject. Opening a PR is not a babysit trigger. After the phase or stack is built and the PR is ready for babysitting, run the **Babysit** playbook (`playbooks/babysit.md`); push back when feedback drifts from intent.

A subagent that opens a PR runs `interrogate`, the **deslop** skill, and the **no-comments** skill, returns the URL, and does NOT babysit. Return to the parent.
