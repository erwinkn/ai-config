---
name: learnings
description: "Capture durable session learnings for future agent performance. Use after coding, debugging, research, reviews, or incident work when the user asks to write notes for future reference. Persist notes in the current project's .agents/learnings folder and create that folder when it does not exist."
---

# Learnings

Write short, reusable notes that help future agents avoid repeating discovery work.

## Required Output Location

- Always save notes under `.agents/learnings/` in the current project.
- Always create the directory first if needed:

```bash
mkdir -p .agents/learnings
```

## File Naming

- Use: `YYYY-MM-DD-<topic-slug>.md`
- Example: `.agents/learnings/2026-02-27-ci-flake-triage.md`
- If no clear topic exists, use `session` as the slug.
- If the target file already exists, append a new timestamped section instead of overwriting.

## Note Template

Use this structure:

```markdown
# <Learning Topic>
Date: <YYYY-MM-DD>
Session: <short task/context>

## What Changed
- <1-3 bullets: code, config, tooling, or process changes>

## Learnings
- <concrete lesson>
- <gotcha and how to avoid it>
- <decision rule for next time>

## Evidence
- <file path, command, PR, issue, or source that supports the learning>

## Next-Time Checklist
- [ ] <small repeatable step>
- [ ] <small repeatable step>
```

## Quality Bar

- Prefer project-specific facts over generic advice.
- Keep it concise: usually 5-15 bullets total.
- Record only information that is likely to help future work.
- Include enough evidence so another agent can verify the claim quickly.
- Do not store secrets, tokens, credentials, or private keys.

## Behavior Rules

- Write the note directly instead of only proposing it.
- If the user asks at the end of a task, create the note before the final response.
- If no meaningful learning exists, write a brief note stating that and why.
