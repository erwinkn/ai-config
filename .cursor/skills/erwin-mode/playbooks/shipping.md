### Shipping

**You own what lands. Verify each PR independently, land only the verified run from the root, then keep your hands off the queue.** For "land the stack", "ship it", "merge the stack", or the second half of a stack that **Babysit** already drove to green.

This is the half after `playbooks/babysit.md`. Babysit makes a stack mergeable. Shipping decides what is actually safe to merge and lets `gh stack merge` drain it. Green is not safe, and the gap between those two words is where this playbook lives.

Stack with `gh stack` + API, same-repo only. Cross-fork stacks are not supported.

1. **Verify every PR independently before merging anything.** One subagent per PR, not batched, each a cloud coding agent on the **QA tester** row in `skills/erwin-mode/references/models.md` for this harness (inherit-parent if that slug is missing), each exercising the real surface (the **control-ui** or **control-cli** skill as the change demands) against parent versus head. Each returns `PASS`, `PASS+NOTES` or `FAIL` and posts that verdict on its own PR so the record outlives the chat. Safe means a verdict from an agent that did not write the code. CI green is not a verdict, and an approving bot review is not a verdict.
2. **Land only the contiguous verified run rooted at the bottom.** Walk up from the lowest unmerged PR and stop at the first one without a passing verdict, where both `PASS` and `PASS+NOTES` pass. A verified PR sitting above an unverified one is not landable, because merging it would pull the gap in underneath it. Report the ceiling as a PR number and say what breaks the chain.
3. **Re-check that the verdicts still describe the code.** A restack rewrites every SHA above it and silently invalidates every verdict without touching a single check. A verdict still holds only when the current parent tree and the full `base...head` diff both match the verdict. Tip `git patch-id` is not enough. It misses an amended earlier commit in a multi-commit PR, and it misses a restack onto different parent code. Re-verify anything that drifted. Twenty-one verdicts went stale this way in one run with no signal at all.
4. **Merge through `gh stack merge`, never `gh pr merge` on a child.** A bare number can resolve as a stack number. Do not pass one until a preflight proves the target.
   Read `gh stack view --json` on the stacker clone. Refuse unless the verified run is the contiguous prefix of that PR list and the next PR is the reported gap.
   If the ceiling is the top of that list, run `gh stack merge --yes` with no argument from that clone.
   If the ceiling is below the tip, prove no GitHub stack has that number, then pass the ceiling PR.
   ```bash
   gh stack merge --yes
   ```
   `gh pr merge` cannot merge a stack and will collapse a child into its parent. If a previous agent armed GitHub auto-merge on a child, disarm with `gh pr merge <n> --disable-auto` and confirm the field is back off.
5. **Never enable GitHub auto-merge on a stacked child.** Only the root targets protected trunk. Every child targets its unprotected parent branch and already reads `CLEAN`, so GitHub would merge children into parents immediately and collapse the stack into itself. `gh stack merge` is what makes the merges sequential.
6. **Once the queue is draining, stop touching the stack.** No `gh stack sync`, no rebase, no speculative pushes, and no `gh stack submit` / `gh stack link`, which reach downstack into PRs that are mid-merge. Independent work gets re-parented onto trunk and shipped on its own.
7. **Watch the drain, do not drive it.** Arm the watcher in queued mode with `--stack-prs` set to the verified run, bottom to top, and hold it under `/loop` in dynamic mode, re-armed after any verdict you act on, until COMPLETE at the ceiling. Without that frozen list the watcher rediscovers the whole connected stack and waits on the unverified PR above the ceiling. ADVANCE is progress, not termination. Bases retarget as each PR merges; that is GitHub stacked-PR merge working, not damage. Report each merge and the new ceiling. If the queue stalls, diagnose before mutating, because a stalled queue and a broken stack look identical from the outside.
8. **Stop at the ceiling.** When the verified run is merged, report what landed, what the next unverified PR is, and what verifying it would take. Extending the run is a new pass through step 1, not a judgment call you make at 3am.

**Reply:** the verified run and its ceiling, each PR's verdict and who produced it, what you merged and how you confirmed it, what landed, and what the next gap needs.
