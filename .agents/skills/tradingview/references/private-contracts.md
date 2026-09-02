# TradingView private contracts

These contracts were observed in a signed-in TradingView web session on 2026-08-10. Treat them as private and unstable.

## Watchlists

- Create an empty custom list:
  - `POST /api/v1/symbols_list/custom/?source=web`
  - body: `{ "name": "Name", "symbols": [] }`
- Read one custom list:
  - `GET /api/v1/symbols_list/custom/{id}/?source=web`
- Append ordered items:
  - `POST /api/v1/symbols_list/custom/{id}/append/?source=web`
  - body: an ordered string array
  - section markers use `###SECTION NAME`
- Replace one symbol:
  - `POST /api/v1/symbols_list/custom/{id}/replace_symbol/?source=web`
  - body: `{ "old": "OLD", "new": "NEW" }`

Use same-origin `fetch` with `credentials: "include"`. Do not extract or store session credentials.

## Chart drawings

- Active widget: `window._exposed_chartWidgetCollection.activeChartWidget._value`
- Active model: `widget.model()`
- Create a horizontal line with `model.createLineTool(...)` and `linetool: "LineToolHorzLine"`.
- The `properties` value must be a TradingView property tree. Clone one from an existing horizontal line. A plain object fails.
- Set the drawing `symbol` explicitly. A cloned property tree retains the seed symbol if it is not overwritten.
- Exact creation saved automatically through TradingView chart storage. A successful save was observed as a `PUT` to the layout `sources` endpoint.

## Safety and verification

- Do not clear all drawings.
- Do not change unlabeled user drawings.
- Use an owned label prefix and exact `text + price` matching.
- Keep automation idempotent.
- Verify after a full page reload. Check both the level match and the drawing's stored symbol.
- Never persist chart JWTs, cookies, HAR files, or other credentials in a skill or deliverable.
