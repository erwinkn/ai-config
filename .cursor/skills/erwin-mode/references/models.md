# Portable model table

In-repo source of truth for Task `model`. Skills name a **role**. They do not hardcode a slug.

## Resolve

1. Detect the harness: Cursor, Claude Code, or Codex.
2. Take that column and the row the skill names.
3. Pass the slug as Task `model`.
4. If that slug is missing in this session (unresolvable, rejected, not in the Task enum), **inherit-parent**.
5. `inherit-parent` and `auto` always mean: omit Task `model`. The subagent runs on the parent chat model.

Cursor is cloud-only. No Composer. Do not invent slugs that are not in this table. No home-dir override. No setup command. This file is the only map.

Claude Code slugs are official API aliases ([Models overview](https://platform.claude.com/docs/en/about-claude/models/overview)). Codex slugs are current Codex CLI names (`gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna`).

## Panels

When a cell lists multiple slugs, spawn **one subagent per list entry**. Do not collapse the list into one agent. Do not invent extra panel members.

Rows that say they copy **how critics** use that harness's how-critics list.

**arena cross-judge pool:** pick one slug from that list. Prefer a different model family from the parent.

**hardest tasks (Cursor):** try `claude-fable-5-thinking-xhigh` first. If that spawn stalls, retry on `claude-opus-5-thinking-high`.

## Table

| Role | Cursor | Claude Code | Codex |
|---|---|---|---|
| feature, refactoring | cursor-grok-4.6-high-fast | claude-sonnet-5 | gpt-5.6-terra |
| bug-fix | gpt-5.6-sol-xhigh | claude-opus-5 | gpt-5.6-sol |
| perf-issue | gpt-5.6-sol-xhigh | claude-opus-5 | gpt-5.6-sol |
| hillclimb | gpt-5.6-sol-xhigh | claude-opus-5 | gpt-5.6-sol |
| judgment and prose | claude-fable-5-thinking-xhigh | claude-fable-5 | gpt-5.6-sol |
| hardest tasks | claude-fable-5-thinking-xhigh (if it stalls: claude-opus-5-thinking-high) | claude-fable-5 | gpt-5.6-sol |
| how explorer | cursor-grok-4.6-high-fast | claude-sonnet-5 | gpt-5.6-terra |
| how explainer | claude-fable-5-thinking-xhigh | claude-fable-5 | gpt-5.6-sol |
| how critics | claude-fable-5-thinking-xhigh, gpt-5.6-sol-xhigh, cursor-grok-4.6-high-fast | claude-fable-5, claude-opus-5, claude-sonnet-5 | gpt-5.6-sol, gpt-5.6-terra |
| why investigators | cursor-grok-4.6-high-fast | claude-sonnet-5 | gpt-5.6-terra |
| why synthesizer | claude-fable-5-thinking-xhigh | claude-fable-5 | gpt-5.6-sol |
| reflect tooling | gpt-5.6-sol-high | claude-sonnet-5 | gpt-5.6-terra |
| reflect judgment, divergent, synthesizer | claude-fable-5-thinking-xhigh | claude-fable-5 | gpt-5.6-sol |
| arena runners | same list as how critics | same list as how critics | same list as how critics |
| arena cross-judge pool | same list as how critics | same | same |
| swarm workers | cursor-grok-4.6-high-fast | claude-sonnet-5 | gpt-5.6-terra |
| architect runners | same list as how critics | same | same |
| interrogate reviewers | same list as how critics | same | same |
| QA tester | gpt-5.6-luna-high | claude-haiku-4-5 | gpt-5.6-luna |
