---
name: tradingview
description: Manage signed-in TradingView through browser automation for custom watchlists, thematic sections, chart navigation, labeled horizontal price levels, persistence checks, and repeatable private request primitives. Use when the user asks to create or update a TradingView watchlist, add price levels or lines to charts, automate repetitive chart setup, inspect TradingView network traffic, or turn a structured symbol-and-level dataset into saved TradingView drawings.
---

# TradingView

Operate the user's signed-in TradingView session without asking for credentials. Keep source-specific research outside this skill. Accept a normalized watchlist or level dataset from the caller.

## Required browser workflow

1. Read and follow `../agent-browser/SKILL.md` before browser operations.
2. Reuse the user's named signed-in session. Discover sessions before opening a new browser.
3. Confirm the active layout and account before changes.
4. Preserve existing watchlists and drawings unless the user explicitly asks to replace or delete them.
5. Prefix created drawing labels with an ownership name such as `Talon ` so exact reruns and safe cleanup are possible.

TradingView does not expose these operations through a supported public API. The private page runtime and request contracts can change. If a contract fails, inspect the live page and network traffic again. Do not guess a replacement request.

## Watchlists

Read `references/private-contracts.md` before watchlist work.

- Keep section markers and symbols in the requested order.
- Use exchange-qualified TradingView symbols.
- Read an existing list before mutation.
- Create a list only after confirming that the target name does not already exist.
- Append only the missing ordered items.
- Never delete or replace a list without explicit user approval.

Load `scripts/watchlists-runtime.js` in the page, then call `CodexTradingViewWatchlists` methods. The runtime only exposes the observed create, read, append, and replace-symbol primitives. It has no delete primitive.

## Labeled chart levels

Use this normalized schema:

```js
[
  {
    symbol: "NASDAQ:NVDA",
    levels: [
      { price: 220, text: "Source Invalidation", kind: "invalid" },
      { price: 235, text: "Source T1", kind: "target" },
    ],
  },
]
```

Supported default kinds are `entry`, `breakout`, `risk`, `invalid`, `target`, and `context`. A caller can supply per-level property overrides in `style`.

### Load the runtime

Load `scripts/chart-levels-runtime.js` into the active TradingView chart page with `agent-browser eval`. Do not paste the runtime by hand.

The runtime needs one existing horizontal line as a property template. Prefer an owned line from the same workflow. If no horizontal line exists, create the first real requested line through the TradingView UI, label it, and use its symbol as `seedSymbol`. Do not create a disposable unlabeled line.

Call:

```js
await CodexTradingViewLevels.prepare({
  seedSymbol: "NASDAQ:NVDA",
  seedTextPrefix: "Source ",
});
```

Then apply small batches:

```js
await CodexTradingViewLevels.applyJobs(jobs, {
  ownedPrefix: "Source ",
  start: 0,
  end: 4,
});
```

Use batches of at most four symbols unless the live timeout permits more. The runtime waits for symbol loading and the automatic chart-storage save. It skips an exact `text + price` match and sets the requested symbol explicitly on each drawing.

## Verification

1. Confirm every apply result has `saved === expected`.
2. Reload the chart page.
3. Load the runtime again and prepare it from a saved owned line.
4. Run `verifyJobs` across all symbols.
5. Require no missing lines and no wrong-symbol assignments.
6. Inspect at least one chart visually. Lines outside the visible price range can be saved correctly but remain off-screen.
7. Report the exact symbol count, level count, skipped exact matches, and any symbols with no supplied levels.

Do not treat a successful in-memory creation as persistence proof. A post-reload exact verification is the completion condition.
