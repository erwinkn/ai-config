---
name: grill
description: "Interview the user in multiple rounds to stress-test a plan, design, or idea. Use when the user asks to be grilled, wants assumptions challenged, or wants a design clarified."
---

# Grill

Resolve a plan or design through rigorous interview rounds. Ask all independent
questions on the current frontier through as many native-tool calls as needed.
Default to discussion-only. Do not edit documentation unless the user explicitly
enables docs mode.


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

In docs mode, follow the same interview loop and capture qualifying terms and
decisions as they resolve. If the user enables docs mode partway through, offer
to capture qualifying terms and decisions already resolved. If they disable it,
stop future doc changes without reverting previously confirmed edits.

## Interview loop

1. Identify the decision the user is trying to make and briefly restate it.
2. Inspect the environment for facts that can be discovered from code, docs,
   configuration, history, or available tools. Look facts up instead of asking
   the user to supply them.
3. Map unresolved decisions as a dependency tree. A decision is ready only when
   all decisions that it depends on are settled.
4. Compute the current frontier: all ready decisions that can be answered
   independently with the facts and prior answers available now.
5. Work through the whole current frontier with consecutive native question-tool
   calls. Include as many questions as the tool permits in each call and include
   a recommended answer and its reason for each.
6. After each call, process the user's answers, then ask the next batch from the
   same frontier. Challenge contradictions, vague terms, hidden assumptions, and
   unresolved edge cases. Remove or revise a pending frontier question when an
   earlier answer makes it obsolete.
7. Record resolved decisions in the conversation and, in docs mode, update the
   appropriate documents as qualifying terms and decisions resolve.
8. Only after all still-relevant questions on the current frontier are resolved,
   recompute the tree and next frontier. Repeat until the frontier is empty or
   the user stops.

The user owns product and design decisions. Never answer those decisions on
their behalf. When a factual discovery changes the decision space, explain the
evidence before asking the next question.

## Question delivery

- Use `request_user_input` or the runtime's native equivalent for every
  interview round. Also use it when a final shared-understanding confirmation
  question is necessary. Do not put interview questions in ordinary prose.
- Use the maximum useful number of questions that the tool permits in each call.
  For Codex `request_user_input`, send one to three questions. If the frontier
  is larger, continue with another native call after the user answers. Send only
  one when only one still-relevant frontier decision remains.
- Give each question two or three mutually exclusive choices. Put the
  recommended choice first, suffix its label with `(Recommended)`, and state
  the effect of each choice in one short sentence.
- Use a short header and a stable snake_case identifier for each question when
  the tool supports them. Let the tool provide its standard free-form choice;
  do not add a duplicate catch-all choice.
- Use ordinary prose only for short evidence or context before the tool call.
  Do not duplicate the tool questions in that prose.
- If no native question tool is available, stop the interview and state that
  `$grill` requires native question input. Do not fall back to prose questions.

## Question quality

- Batch independent frontier questions, but never include a question whose
  answer depends on another open question in the same round.
- Do not postpone a ready independent question only because one tool call is
  full. Ask it in the next native batch before advancing to the next frontier.
- Prefer high-leverage questions that constrain several downstream choices.
- Use concrete scenarios to expose edge cases and ambiguous boundaries.
- Recommend a choice instead of presenting an unranked menu.
- Skip questions whose answers are already clear from the request, conversation,
  or repository.
- Keep going past the first plausible answer when meaningful branches remain.

## Documentation rules

Apply these rules only in docs mode.

Before the first interview round, read the repository instructions and the
relevant existing `CONTEXT.md`, `CONTEXT-MAP.md`, and ADRs. If they do not
exist, continue without flagging their absence. Preserve surrounding content
and unrelated changes.

During the interview:

- Challenge a term immediately when it conflicts with the existing glossary.
- Propose a precise canonical term when the user's language is vague or
  overloaded.
- Test domain relationships with concrete edge-case scenarios.
- Compare factual statements with the code and surface contradictions.

### Glossary

Use `CONTEXT.md` only for project-specific domain language:

- Create the relevant `CONTEXT.md` lazily when the first term resolves.
- Update the glossary when each term resolves; do not batch updates until the
  end of the interview.
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
new convention. Create the relevant ADR directory lazily when the first ADR is
needed.

## Completion

Do not act on the discussed plan until the user confirms that shared
understanding has been reached. Then summarize:

- decisions made,
- important constraints and non-goals,
- unresolved questions, if any,
- the recommended next step, and
- documentation changed, when docs mode was enabled.
