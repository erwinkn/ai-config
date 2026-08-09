---
name: grill
description: "Interview the user one decision at a time to stress-test a plan, design, or idea. Use when the user asks to be grilled, wants assumptions challenged, or wants a design clarified; default to discussion-only, and enable documentation mode only when the user explicitly asks to record glossary terms or ADRs."
---

# Grill

Resolve a plan or design through a rigorous, one-question-at-a-time interview.
Default to discussion-only. Do not edit documentation unless the user explicitly
enables docs mode.

<!--
Adapted from mattpocock/skills' grill-me, grilling, grill-with-docs, and
domain-modeling skills. See LICENSE in this skill folder.
-->

## Modes

### Discussion mode (default)

- Read the current conversation and inspect relevant repository context before
  asking questions.
- Do not create or edit documentation.
- Do not implement the plan being discussed.

### Docs mode (explicit opt-in)

Enable docs mode only when the user explicitly asks for it with wording such as
"with docs", "docs mode", "record this in the docs", or an equivalent request.
Do not infer docs mode from the presence of `CONTEXT.md`, ADRs, or other project
documentation.

In docs mode, follow the same interview loop and capture confirmed decisions as
they resolve. If the user enables docs mode partway through, offer to capture
the important decisions already made. If they disable it, stop future doc
changes without reverting previously confirmed edits.

## Interview loop

1. Identify the decision the user is trying to make and briefly restate it.
2. Inspect the environment for facts that can be discovered from code, docs,
   configuration, history, or available tools. Look facts up instead of asking
   the user to supply them.
3. Find the next unresolved decision whose answer unlocks later questions.
4. Ask exactly one question. Include a recommended answer and the reason for
   recommending it.
5. Wait for the user's answer. Challenge contradictions, vague terms, hidden
   assumptions, and unresolved edge cases rather than accepting them silently.
6. Record the resolved decision in the conversation and, in docs mode, update
   the appropriate document after the user confirms it.
7. Repeat until the important branches are resolved or the user stops.

The user owns product and design decisions. Never answer those decisions on
their behalf. When a factual discovery changes the decision space, explain the
evidence before asking the next question.

## Question quality

- Ask one question per turn. Never send a questionnaire or bundle unrelated
  decisions together.
- Prefer dependency order: settle decisions that constrain several downstream
  choices first.
- Use concrete scenarios to expose edge cases and ambiguous boundaries.
- Recommend a choice instead of presenting an unranked menu.
- Skip questions whose answers are already clear from the request, conversation,
  or repository.
- Keep going past the first plausible answer when meaningful branches remain.

## Documentation rules

Apply these rules only in docs mode.

Before writing, read the repository instructions and the relevant existing
`CONTEXT.md`, `CONTEXT-MAP.md`, and ADRs. Preserve surrounding content and
unrelated changes.

### Glossary

Use `CONTEXT.md` only for project-specific domain language:

- Define each canonical term in one or two sentences.
- List misleading synonyms under an `_Avoid_:` line when useful.
- Keep implementation details, plans, and temporary discussion out of the
  glossary.
- If the repository uses `CONTEXT-MAP.md`, update the context relevant to the
  current discussion.

### ADRs

Offer or write an ADR only when the decision is all three:

1. costly to reverse,
2. surprising without its context, and
3. the result of a real trade-off.

Keep the ADR concise: state the context, decision, and reason. Match the
repository's existing location, numbering, and format rather than imposing a
new convention.

## Completion

Do not act on the discussed plan until the user confirms that shared
understanding has been reached. Then summarize:

- decisions made,
- important constraints and non-goals,
- unresolved questions, if any,
- the recommended next step, and
- documentation changed, when docs mode was enabled.
