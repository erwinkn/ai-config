# Cross-provider execution

Use the native named agent when its host supports the assigned provider/model. Otherwise the named bridge drives the installed provider CLI. A foreign model ID in native frontmatter does not change providers. The bootstrap model must not do the specialist's work or claim it produced an independent result.

## Preconditions

The lead supplies an absolute stack root, the workspace, expected revision, owned scope, goal, required behavior, procedure, acceptance evidence, authority, budget, and return destination. Each simultaneous writer has a separate worktree. Verify the actual starting revision: host-created worktrees may branch from the default branch rather than the parent's changes.

Read the canonical role and selected skill. Materialize a private, self-contained leaf brief with their instructions, necessary references, settled design decisions, exact inputs, and the report requested. Tell the leaf to execute directly rather than dispatch its own role again. The parent retains canonical integration, commits, publication, and the one decision log unless those exact responsibilities were delegated.

Check the installed executable, version, and help before its first use. Confirm model and flag support. Existing user/organization permissions, data-egress restrictions, hooks, and sandbox limits remain binding. Use normal installed authentication; do not read, copy, print, or commit credentials. An unavailable model or incompatible sandbox is a blocker, not permission to impersonate the model or bypass restrictions.

The command examples below are recipes, not a custom runner. The current agent supplies actual validated values, imports the named standard-library modules, observes the child, and performs cleanup. Use argument arrays rather than interpolating generated prompts into shell commands. PROMPT, RESULT, and EVENTS are different files in the run's private scratch directory.

## Codex

Run from the assigned WORKSPACE. MODEL and EFFORT come from the canonical role. Keep a stricter inherited policy; these flags must not relax an existing restriction.

```python
import subprocess
with open(PROMPT, encoding="utf-8") as source, open(EVENTS, "w", encoding="utf-8") as events:
    completed = subprocess.run(
        ["codex", "exec", "--ephemeral", "--model", MODEL,
         "--sandbox", "read-only" if ACCESS == "read" else "workspace-write",
         "-c", f'model_reasoning_effort="{EFFORT}"',
         "-c", "agents.enabled=false", "--json", "-o", RESULT, "-"],
        cwd=WORKSPACE, stdin=source, stdout=events, stderr=subprocess.STDOUT,
        timeout=TIMEOUT_SECONDS, check=False,
    )
```

Do not use permission-bypass options or add broad writable roots. Ordinary writing workers return their changes for the lead to commit; sandbox restrictions on `.git` or network are not errors to route around. Inspect nonzero exits, denied tool calls, and the actual diff. A result file alone does not establish completion. If an installed version lacks an option, report the capability mismatch rather than invent flags.

## Claude

Foreign Fable roles start a fresh Claude CLI session. Read-only roles use plan permission mode. Writing roles retain normal user permission handling and their assigned scope; a designer writes design artifacts, not product code.

```python
import subprocess
argv = ["claude", "-p", "--model", MODEL, "--effort", EFFORT,
        "--output-format", "json"]
if ACCESS == "read":
    argv += ["--permission-mode", "plan"]
with open(PROMPT, encoding="utf-8") as source, open(RESULT, "w", encoding="utf-8") as output:
    completed = subprocess.run(argv, cwd=WORKSPACE, stdin=source, stdout=output,
                               stderr=subprocess.PIPE, timeout=TIMEOUT_SECONDS, check=False)
```

Do not remove nested-session safeguards or add `--dangerously-skip-permissions`. A headless task unable to obtain required approval reports blocked. If read-only analysis requires an experiment that writes files, the lead provisions an authorized scratch experiment or assigns it to an implementer. Do not silently change the role's authority. Check both exit status and JSON result for actual completion.

## Grok

The second reviewer uses Grok Build with `grok-4.6`. Effort is the installed runner's default; no undocumented effort flag is assumed. Inspect the installed model catalog and `grok inspect` when resolution or inherited configuration is uncertain. The bridge must disclose incompatible inherited instructions rather than silently change the user's global or Cursor setup.

```python
import os
import subprocess
env = os.environ.copy()
env.update({"GROK_SUBAGENTS": "0", "GROK_MEMORY": "0",
            "GROK_WRITE_FILE": "0", "GROK_SANDBOX": "read-only"})
with open(RESULT, "w", encoding="utf-8") as output:
    completed = subprocess.run(
        ["grok", "--no-auto-update", "-m", MODEL, "--cwd", WORKSPACE,
         "-p", f"Read the leaf review brief at {PROMPT} and execute it without delegating.",
         "--output-format", "json"],
        env=env, stdout=output, stderr=subprocess.PIPE,
        timeout=TIMEOUT_SECONDS, check=False,
    )
```

The full brief and source code stay out of process arguments. Keep a stricter inherited sandbox profile if present; never lower it to the example profile. Disabling the write tool is not a substitute for the sandbox or restricted MCP permissions. Use existing normal login or XAI_API_KEY supplied by the user's environment. Do not use `--always-approve`. An unavailable reviewer is missing coverage, not a completed second opinion.

## Collection, cancellation, and evidence

Foreground collection is the default. For a genuinely long task, use the host's supported background-process handle and blocking collection capability; keep ownership until a terminal result. Do not end the task while its child remains uncollected. Persist its handle and result/log paths before yielding. Do not start detached work if the host cannot collect it.

On timeout or cancellation, terminate and reap only the run's owned process group/descendants, not every process with the executable's name. The simple subprocess examples do not implement a full descendant lifecycle; the calling agent must use the host's process-management facilities for that case. Preserve partial work and useful evidence, report the state, and leave no claimed watcher running without a handle.

Read the result, inspect artifacts at the expected revision, and distinguish an empty result, tool failure, partial completion, and success. Record requested specialist and observed model separately; if the actual model is not observable, state that. Return significant decisions, failed attempts, exact checks, deviations, and gaps to the lead. Provider traces may contain source, secrets, or internal reasoning: keep them private and publish only sanitized evidence and concise decision rationale. Portable handoffs are fresh task briefs, not rewrites of opaque provider reasoning history.

## Official references

These are configuration/command sources, not evidence of a successful authenticated run in the user's account.

- [Claude agent definitions](https://code.claude.com/docs/en/sub-agents) and [CLI reference](https://code.claude.com/docs/en/cli-reference).
- [Codex agent definitions](https://developers.openai.com/codex/subagents), [skills](https://developers.openai.com/codex/skills), and [CLI reference](https://developers.openai.com/codex/cli/reference).
- [Grok headless mode](https://docs.x.ai/build/cli/headless-scripting) and [settings](https://docs.x.ai/build/settings/reference).
