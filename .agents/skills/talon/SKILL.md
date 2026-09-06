---
name: talon
description: Turn Glitch SPX Talon weekly Substack posts into structured thematic watchlists and labeled TradingView chart levels. Use when the user references a Talon weekly sector watchlist, a glitchspx.substack.com Talon post, Talon sections or setups, or asks to create, refresh, compare, or verify a Talon TradingView workspace.
---

# Talon

Convert a Talon post into a factual, source-backed configuration. Keep Talon interpretation here. Delegate all TradingView mechanics to the sibling `tradingview` skill.

## Workflow

1. Read the complete source post. Use the public post or the user's supplied text. Do not rely on search snippets.
2. Extract section order, symbols, setup direction, and every explicit numeric setup level.
3. Read `references/extraction-contract.md` and normalize the result to its schema.
4. Validate counts, duplicate prices, symbol aliases, and skipped symbols before browser changes.
5. Read and follow `../tradingview/SKILL.md`.
6. Create or update the `Talon` watchlist with the source's thematic order.
7. Add only explicit setup levels. Prefix every drawing label with `Talon `.
8. Run the TradingView post-reload verification for every eligible symbol.
9. Report the source date, watchlist sections, eligible symbols, saved level count, and symbols skipped because the post had no explicit numeric setup levels.

## Interpretation rules

- Treat the post as the sole source of setup levels.
- Do not turn a current market quote into a setup level.
- Do not invent an entry for phrases such as `current zone` when no numeric entry is supplied.
- Preserve invalidations, risk floors or ceilings, breakout or breakdown retests, forward support or resistance, targets, VEX ladders, downside ladders, and dealer-area boundaries.
- Deduplicate the same price on the same symbol. Combine its meanings in one concise label.
- Keep bullish and bearish direction in labels when it prevents ambiguity.
- Map retired or author-specific tickers to the current TradingView symbol only after verification. Record the mapping.
- Keep symbols without explicit numeric levels in the watchlist. Do not add drawings to them.

## Completion condition

Do not stop after watchlist creation or in-memory line creation. Complete only after the TradingView skill verifies every expected line after a page reload and finds no wrong-symbol assignments.
