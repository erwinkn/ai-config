# User preferences

## Response language

- Write all user-facing prose in ASD-STE100 Simplified Technical English.
- Apply this rule to explanations, plans, reviews, summaries, and questions.
- Do not change source code, identifiers, commands, quotations, logs, or text that must follow another specified style.

## Picking the right models for workflows and subagents

Rankings, higher = better. Cost reflects what I actually pay (OpenAI has really generous
limits), not list price. Intelligence is how hard a problem you can hand the model
unsupervised. Taste covers UI/UX, code quality, API design, and copy.

| model    | cost | intelligence | taste |
|----------|------|--------------|-------|
| gpt-5.5  | 9    | 8            | 5     |
| sonnet-5 | 5    | 5            | 7     |
| opus-5   | 4    | 8            | 8     |
| fable-5  | 2    | 9            | 9     |

Opus 5 supersedes Opus 4.8 — use Opus 5 wherever the older guidance said 4.8.

How to apply:
- These are defaults, not limits. You have standing permission to override them: if a cheaper
model's output doesn't meet the bar, rerun or redo the work with a smarter model without
asking. Judge the output, not the price tag. Escalating costs less than shipping mediocre
work.
- Cost is a tie-breaker only; when axes conflict for anything that ships, intelligence >
taste > cost.
- Bulk/mechanical work (clear-spec implementation, data analysis, migrations): gpt-5.5 — it's
effectively free.
- Anything user-facing (UI, copy, API design) needs taste ≥ 7.
- Reviews of plans/implementations: fable-5 or opus-5, optionally gpt-5.5 as an extra
independent perspective.
- Never use Haiku.
- Rate limits are real: fable-5 in particular runs out. If a delegated agent dies with a
usage-limit error, switch it to the next model down the same axis (fable-5 → opus-5) and
re-send the prompt rather than waiting or silently downgrading the work.
- Mechanics: gpt-5.5 is only reachable through the Codex CLI — `codex exec` / `codex review`
(my ~/.codex/config.toml defaults to gpt-5.5). Use the codex-implementation, codex-review,
and codex-computer-use skills; for work they don't cover (investigation, data analysis), run
`codex exec -s read-only` directly with a self-contained prompt.
- Claude models (sonnet-5, opus-5, fable-5) run via the Agent/Workflow model parameter.

Using gpt-5.5 inside workflows and subagents (the model parameter only takes Claude models,
so use the dedicated driver agents):
- `codex-implementer`, `codex-reviewer`, and `codex-computer-use` (defined in
~/.claude/agents/, declaring `model: opus`, i.e. the current Opus release) drive Codex per
the matching skill — pass them
via `subagent_type` on the Agent tool or `agentType` in Workflow `agent()` calls. Give them
the task and repo path; they compose the codex prompt, run it, and judge the result
themselves.
