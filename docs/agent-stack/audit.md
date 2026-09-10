# Implementation decision audit

This is an author audit. No independent LLM auditor or authenticated specialist run is claimed. [The log](decisions.tsv) records consequential choices; [the source map](source-mapping.md) records their provenance. Model assignments are initial user preferences, not a measured ranking.

| Decision | Evidence | Support | Consequence |
| --- | --- | --- | --- |
| Replace only non-Cursor instructions and skills. | Git comparison against `d7a1a8c63f89fd9ba63edfd72330ae929489d3ab`; protected Cursor tree hashes. | Verified for the built tree. | Main, Cursor setup, credentials, and unrelated installer code are untouched. |
| Canonical Markdown generates native host definitions. | Renderer idempotence and model-change regression tests. | Verified structurally. | Model assignment has one editable source; generated files are committed. |
| Foreign providers use explicit CLI bridges. | Official host references and generated definitions. | Supported; authenticated execution unverified. | Installed CLIs, account entitlement and compatible inherited permissions are required. |
| Manual rewrite is separate from normal simplification. | Both host invocation controls and negative tests. | Verified structurally, behavior not trialed. | Delivery cannot automatically invoke a full rewrite. |
| Delivery ends at merge-ready with a decision audit. | Deliver/babysit/ship/audit procedures and references. | Implemented guidance; end-to-end behavior unverified. | No merge, auto-merge or deployment is implied. |

## Verified checks

The build ran the structural checker and 20 offline regression tests, including missing-reference, wrong-invocation-policy, unknown-runner, model-drift, symlink, log-integrity, and Cursor-preservation cases. Native files parse and match their canonical definitions. All 252 upstream mapping rows and destination IDs resolve. Current CI results belong to their exact checked commit; a later edit invalidates affected evidence.

Original protected tree objects: `.cursor` is `cd42921370e9a5b7ff51b463d329b096b5de73bb`; `.cursor-plugin` is `3fec4602d21ad1d870d8ec37f750bd803af93d71`. The Cursor harness fragment is unchanged. No tracked Amp catalog existed. No root AGENTS.md or CLAUDE.md was added.

## Attention

- No authenticated Claude, Codex, or Grok model trial was run. Test a narrow scout and cross-provider design/review task after installation, then a bounded delivery.
- A CLI bridge adds bootstrap cost; actual cost/performance and trigger adherence remain unmeasured. Missing access is a blocker, never a reason for silent substitution or a permission bypass.
- Worktree ownership and delegated authority are instructions plus existing host controls, not a new enforced scheduler. Verify the exact candidate revision.
- Existing main-session permissions and ignored local settings were preserved. This change does not harden a permissive host or override local model choices.
- The existing `ai apply` operates on all managed harnesses, including Cursor MCP. No installation or active-home application was performed. Preserved Cursor files do not imply that a host which discovers shared skills cannot see the new catalog.
- No independent model review of this implementation is claimed; offline tests and author inspection are not substituted for it.

## Disposition

Implemented as a branch-scoped candidate. The full-rewrite procedure and empirical model-role choices remain experiments for real projects. Check current PR checks and requirements before merging. Nothing in this audit authorizes merging, auto-merge, or deployment.
