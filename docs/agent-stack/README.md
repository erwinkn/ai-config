# Unified agent stack

This implements the approved Revision 5 as Markdown skills and agent definitions. It replaces the previous non-Cursor catalog rather than layering another catalog over it. There is no custom scheduler, routing service, or agent runtime.

## Layout

| Location | Purpose |
| --- | --- |
| `.agents/AGENTS.md` | Shared conversational lead instructions and procedure selection. |
| `.agents/skills/` | 31 packages: 21 work skills, nine playbooks, and shared principles. |
| `.agents/agents/` | 12 canonical roles with explicit model, runner, effort, and responsibility. |
| `.claude/CLAUDE.md` | Imports shared instructions and specifies Claude behavior. |
| `.claude/skills` | Symlink to canonical skills. |
| `.claude/agents/` | Generated native Claude definitions. |
| `.codex/AGENTS.md` | Symlink to shared instructions. |
| `.codex/agents/` | Generated native Codex TOML definitions. |
| `.config/ai/shared/` | Existing portable settings mechanism, with selected main models updated and obsolete skill exclusions removed. |

The old `.agents` skills and lockfile and three old Claude driver definitions are removed. There was no tracked Amp setup. `.cursor/`, `.cursor-plugin/`, the Cursor harness settings, existing configuration CLI, installation code, native authentication, and machine-local overlays remain unchanged. No root AGENTS.md or CLAUDE.md is added to this home-dotfiles mirror. A host that discovers shared `.agents` skills may still see the new shared catalog; byte-preserving Cursor files is not a claim that shared discovery has no effect.

## Daily use

Describe the outcome normally. The lead selects procedures and named roles. A ready build request or execution of an approved plan enters `deliver`, which proceeds through structural assessment, fresh review/fixes, verification, PR publication, feedback and CI follow-through, and a decision audit to merge-ready. Research, planning, diagnosis-only, and review-only requests keep their narrower endpoints. Merge, auto-merge, deployment, destructive data changes, and published-history rewrites require their specific authority.

`setup` and `rewrite` are manual-only. Claude uses `disable-model-invocation: true`; Codex uses `agents/openai.yaml` with `allow_implicit_invocation: false`. `compound` is model-invokable: an explicit instruction to update the stack authorizes that focused edit, while inferred preferences remain proposals.

Normal simplification improves the integrated design after implementation and material review churn. A full `/rewrite` instead preserves the original PR and base, reconstructs semantic and operational obligations, starts a fresh writer/worktree from the base, independently compares and verifies the result, and publishes a separate comparison PR when worthwhile. It is never an automatic delivery phase.

## Model assignments

See [the role table](../../.agents/agents/README.md). Initial assignments follow the user's preferences: Fable 5.1 medium for the lead; Fable high for analysis, design, review, and audit; Luna low for exploration; Sol medium for ordinary implementation and verification; Terra medium for mechanical edits; Astra high for difficult implementation and structural simplification; Grok 4.6 for a second review. Grok effort uses the installed runner default.

Claude's main-session setting is Fable medium. Codex's main session uses Astra high and delegates Fable tasks as needed. A delegated lead is for a bounded workstream, not a new management layer on every request.

Native model fields cannot switch providers. Foreign-provider definitions explicitly drive the existing `claude`, `codex`, or `grok` CLI. Claude bridges bootstrap on Fable medium, Codex bridges on Luna low, then run the configured specialist. This introduces overhead; it must never be confused with a specialist run or an independent review. [Execution instructions](../../.agents/agents/references/execution.md) define the command shapes, scope, collection, evidence, and failure behavior.

No credentials are provisioned or copied. Use normal CLI authentication and actual model entitlement. Missing executables, accounts, models, tool access, or compatible sandbox behavior are explicit blockers. Do not silently substitute models or bypass permissions. Requested and observed model must be reported separately when a host can substitute or cannot expose the actual executor. These are initial assignments, not a measured ranking.

## Authoring and validation

Edit canonical Markdown, then regenerate native role files from the configuration checkout:

```sh
python3 .agents/scripts/render_agents.py
python3 .agents/scripts/check.py
python3 -m unittest discover -s .agents/tests -v
```

Python 3.11 or newer is required for authoring-time validation. The tools never launch models or read authentication. `render_agents.py --check` reports drift without writing. Canonical metadata uses the JSON-scalar subset of YAML. The renderer refuses unknown native definitions rather than silently deleting later user additions.

Both generated host formats are committed, so ordinary use needs no generation step. Skills and references stay single-source. The offline tests check negative cases, invocation controls, native serialization, model drift, symlinks, provenance, and log integrity. They do not prove that a host actually loaded the configuration, that the user's accounts can run the models, or that the prompts improve results.

After choosing to install the branch, start a fresh session and first try a narrow scout and a cross-provider designer/reviewer, then a bounded delivery. The [representative trials](../../.agents/evals/README.md) support actual-use feedback without a benchmark platform. Record human corrections and real outcomes; do not grade compliance by the agent's self-report.

## Installation boundary

This PR does not switch the user's active dotfiles branch, install onto their home directory, or write active `.claude/settings.json` / `.codex/config.toml`. Those remain managed by the existing installation/settings workflow. Existing ignored local settings can override new model defaults or retain obsolete disabled skills; review them when adopting the branch.

The existing `ai apply` manages all configured harnesses, including Cursor MCP. Do not run it blindly when unrelated pending configuration must be preserved. This change does not alter that installer or apply anything on the user's machine. Existing main-session permission settings and plugins are preserved; the new instructions do not turn a permissive host into a hardened sandbox.

## Decisions and sources

Substantive delivery maintains one chronological lead-owned log and a confidence-qualified audit derived from actual evidence. Workers return observations; they do not concurrently write the log. See the [record contract](../../.agents/skills/deliver/references/record.md), optional `record.py` helper, and `audit` procedure. Publish redacted evidence and concise rationale, not raw provider traces or private internal reasoning.

- [Source-to-implementation mapping](source-mapping.md): all 252 source rows and physical destinations.
- [Machine-readable source map](source-map.json), [implementation index](implementation-index.json), and [pinned upstream revisions](source-revisions.json).
- [User design decisions](revision-decisions.json), [implementation work log](decisions.tsv), and [author audit](audit.md).

The mappings are provenance, not a second executable instruction corpus. Author-specific incidents, arbitrary mandatory fan-out counts, blanket comment deletion, automatic full rewrites, unsupported model claims, and custom orchestration machinery are not imported as universal requirements.
