# Talon extraction contract

## Watchlist schema

Preserve source order:

```json
{
  "name": "Talon",
  "items": [
    "###MARKET & HEDGES",
    "AMEX:SPY",
    "###SEMICONDUCTORS",
    "NASDAQ:NVDA"
  ]
}
```

Use exchange-qualified TradingView symbols. A section marker starts with `###`.

## Level-job schema

```json
[
  {
    "symbol": "NASDAQ:NVDA",
    "levels": [
      { "price": 220, "text": "Talon Invalidation", "kind": "invalid" },
      { "price": 235, "text": "Talon T1", "kind": "target" }
    ]
  }
]
```

Allowed `kind` values:

- `entry`: OTE, best entry, or an explicit numeric execution zone
- `breakout`: breakout, breakdown, hold, or retest
- `risk`: tactical risk floor or ceiling
- `invalid`: structural or tactical invalidation
- `target`: first targets, target ladders, VEX ladders, and downside ladders
- `context`: forward support or resistance and dealer-area bounds

## Include

- Explicit numeric OTE or entry values
- Explicit breakout, breakdown, hold, or retest values
- Explicit risk floors or ceilings
- Explicit structural invalidations
- Explicit first targets and target ladders
- Explicit VEX or downside ladders
- Explicit numeric dealer-exposure area bounds
- Explicit numeric forward support or resistance

## Exclude

- Current price quotes
- Nonnumeric `current zone` entries
- General narrative, catalysts, and sentiment
- Indicator values that are not named setup levels
- Implied levels derived from charts or outside sources

## Deduplication

Use one line when two labels share one price. Combine meanings in priority order:

1. Invalidation or risk meaning
2. Breakout or breakdown meaning
3. First-target meaning
4. VEX, downside, or context meaning

Examples:

- `Breakout / VEX 1`
- `First target / VEX 2`
- `VEX 2 / dealer low`

## Validation record

Before TradingView changes, record:

- Source title and publication date
- Ordered section count
- Total watchlist symbol count
- Eligible symbol count
- Total deduplicated level count
- Symbols skipped for no explicit numeric levels
- Symbol alias mappings and their reasons

After changes, require the same eligible-symbol and level totals in the post-reload TradingView verification.
