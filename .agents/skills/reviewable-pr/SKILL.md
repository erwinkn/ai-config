---
name: reviewable-pr
description: Create or update a GitHub pull request with a reviewer-guided description, exact code references, ASD-STE100 Simplified Technical English, collapsed walkthrough sections, decision records, and non-duplicated verification evidence. Use only when the user explicitly invokes $reviewable-pr for the current branch or a specified pull request.
---

# Create a reviewable GitHub pull request

Create or update a pull request that a reviewer can understand from the description. Use exact repository evidence. Do not infer unverified behavior.

Read [`assets/pr-description-template.md`](assets/pr-description-template.md) before drafting. Run [`scripts/validate-pr-description.mjs`](scripts/validate-pr-description.mjs) before completion.

## 1. Resolve the publication scope

1. Read the repository instructions.
2. Inspect the current worktree, branch, status, remotes, and existing pull request.
3. Fetch the base branch before comparison.
4. Resolve the base from the user request, existing pull request, or stack parent.
5. Preserve unrelated work. Stage explicit paths when a commit is required.
6. Stop and ask when the dirty-worktree scope is ambiguous.
7. Never merge the pull request.

For a stacked pull request, verify each pull request number, URL, branch, base, and stack position from GitHub.

## 2. Build the evidence inventory

Inspect the complete base-to-head change before writing.

- List every changed file and its status.
- Read the commits and the full diff.
- Identify the prior behavior from the base revision.
- Identify the new behavior from the head revision.
- Record each changed dependency, ownership, data-flow, or lifecycle boundary.
- Record each decision, alternative, non-goal, test, check, and unresolved risk.
- Run relevant checks when they have not run on the exact head revision.
- Mark a check as not run when no current result exists.

Use exact identifiers. Name classes, methods, interfaces, modules, constants, files, test suites, branches, and pull requests.

Do not replace names with count-based shorthand such as “three classes,” “two adapters,” or “all affected callers.”

## 3. Establish the pull request identity

If the pull request does not exist, create it as a draft with a temporary body. Obtain its number and URL before writing the final description.

Use the repository's existing title and branch conventions. Do not use an agent name in the branch name.

For the important callout:

- Link each pull request by number.
- Put the review order only in the callout.
- Do not put branch names in the callout.
- Do not put design details in the callout.

For a standalone pull request, link only that pull request. For a stack, link every pull request in review order.

## 4. Draft the description

Copy the template to a temporary file. Replace every placeholder. Remove an optional section only when it does not apply.

### Architecture

Architecture diagrams are optional. Add a Mermaid diagram only when the diagram makes a material relationship easier to review than prose or the walkthrough.

Do not add a diagram only because the change modifies ownership, dependency flow, data flow, lifecycle, or layered architecture. Omit diagrams for small or linear changes when the review order already explains the change.

When a diagram is useful:

- Use one diagram unless a before-and-after comparison is necessary.
- Keep each diagram at the highest useful level.
- Name every node with the exact class, service, registry, module, or transport.
- Use a layout that makes the intended groups and flow clear at normal pull request width.
- Render the final Mermaid source and visually inspect the image before publication.
- Check label readability, node order, arrow endpoints, crossings, bundled lines, spacing, and relative complexity.
- Revise and render the diagram again after every diagram source change.

Do not treat successful Markdown rendering or Mermaid parsing as a visual review. If visual inspection is not possible, remove the diagram or stop before publication.

Pass `--diagrams-reviewed` to the validator only after visual inspection of every Mermaid diagram in the final body.

Do not repeat the diagram as prose. Add prose only for facts that the diagram cannot show.

### Decision map

Write one row per material decision. Name every implementation symbol in the result cell.

Use the map as an index. Keep rationale and alternatives in the decision record.

### Review walkthrough

Order steps by dependency or execution flow, not by filename.

For every step:

1. State the prior behavior under `Before this PR`.
2. State the new behavior under `This PR`.
3. Name every changed symbol and caller.
4. Add nested file panels in the review order.
5. Link every changed file to its GitHub diff anchor.
6. Show only literal diff excerpts copied from the base-to-head diff.
7. Label conceptual examples as pseudocode. Never label synthetic code as `diff`.

The architecture or an earlier step can establish a prior fact. Even then, keep the step transition explicit when a reviewer could miss the prior behavior.

Use these walkthrough labels:

- `WHY` for the starting problem.
- `PRINCIPLE` for the design rule.
- `STEP` for review order.
- `NEW`, `MODIFIED`, `RENAMED`, or `REMOVED` for file panels.
- `KEPT` for deliberate non-changes.

Do not add a `VERIFY` walkthrough panel. Put all verification evidence at the end.

Every `<details>` block must:

- stay collapsed by default;
- omit the `open` attribute;
- put `<br />` after `</summary>` with one blank line on each side;
- close before the next peer section.

### Decision record

Create one collapsed entry per material decision. Include:

- `Decision`;
- `Before this PR` when the prior state is not already explicit;
- `Reason`;
- `Alternatives not selected`;
- `Result`;
- exact `Review questions`;
- a literal principal diff when useful;
- direct file-diff links.

### Evidence and verification

Put verification evidence in one section at the end. Do not duplicate it in the walkthrough or another evidence section.

Map each boundary to exact test files or checks. Separate verified results from checks that did not run.

Add stack details after evidence only for a stacked pull request. Link each pull request and name each head and base branch.

Remove the `Stack` section for a standalone pull request.

## 5. Apply ASD-STE100 Simplified Technical English

Use these rules for all prose:

- Use one technical term for one concept.
- Keep exact code identifiers unchanged.
- Use active voice.
- Use one instruction or fact per sentence.
- Keep descriptive sentences at 25 words or fewer.
- Use short, common words outside code identifiers.
- Use vertical lists for several items.
- Do not use semicolons.
- Repeat the exact noun when a pronoun could be unclear.
- State conditions before actions.
- Prefer positive instructions.

Replace vague phrases with exact references.

| Do not write | Write |
|---|---|
| `PennylaneModule provides three classes` | `PennylaneModule provides PennylaneHttpClient, PennylaneFileDownloader, and PennylaneProvider` |
| `the two adapters` | `PennylaneInvoicingProvider and PennylaneAccountingProvider` |
| `all affected callers` | the exact caller names |
| `the same behavior` | the exact value, error, status, or side effect |
| `both registries` | the exact registry names |
| `the applicable path` | the exact method or execution path |

A list lead-in can use “these” only when the exact names follow immediately.

## 6. Prevent duplication

Give each section one purpose.

- The overview states purpose and review order.
- Architecture diagrams show relationships when a diagram improves the review.
- The decision map indexes decisions.
- The walkthrough explains the review sequence and code changes.
- The decision record explains rationale and alternatives.
- Deliberate non-goals state excluded work.
- Evidence and verification contain all check results.
- Stack contains pull request order and branch relationships.

Summaries can point to detailed sections. Do not copy detailed evidence or rationale into a second section.

## 7. Publish and validate

Create or update the pull request with a body file. Do not pass a long body through shell quoting.

After the draft pull request exists, validate the local body file against its identity and changed files:

```sh
node .agents/skills/reviewable-pr/scripts/validate-pr-description.mjs \
  /path/to/pr-body.md \
  --repo OWNER/REPOSITORY \
  --pr NUMBER
```

If the body contains Mermaid diagrams, render and visually inspect the final diagrams. Then, add `--diagrams-reviewed`:

```sh
node .agents/skills/reviewable-pr/scripts/validate-pr-description.mjs \
  /path/to/pr-body.md \
  --repo OWNER/REPOSITORY \
  --pr NUMBER \
  --diagrams-reviewed
```

After the body update, validate the live pull request:

```sh
node .agents/skills/reviewable-pr/scripts/validate-pr-description.mjs \
  --repo OWNER/REPOSITORY \
  --pr NUMBER
```

Add `--diagrams-reviewed` to the live validation only when the live body contains the visually reviewed Mermaid source.

The validator checks the live pull request body, changed-file links, GitHub rendering, and the diagram review acknowledgement.

Fix every error. Review every warning. Re-run the validator after each body update.

Then verify:

- the live head and base branches;
- the stack order, when applicable;
- the current check state;
- the final body after the last update;
- a clean worktree after removing temporary files.

Report the pull request link, publication state, verification result, and any remaining risk. Stop before merge.
