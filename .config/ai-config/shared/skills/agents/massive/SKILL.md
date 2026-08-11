---
name: massive
description: Massive.com financial market data API guidance. Use when building, debugging, or answering questions about Massive REST endpoints, Massive WebSocket real-time streams, Massive market data schemas, or the Massive MCP server for stocks, options, forex, crypto, futures, fundamentals, news, and market reference data.
---

# Massive

## Overview

Use this skill for Massive.com market data work. Prefer the live `llms.txt` docs over memory because endpoint coverage, parameters, channel names, and examples can change.

## Documentation

Read [references/doc-sources.md](references/doc-sources.md) before answering implementation questions:

- Use the REST `llms.txt` for HTTP endpoints, request parameters, response fields, pagination, historical data, reference data, and snapshots.
- Use the WebSocket `llms.txt` for real-time connection URLs, auth flow, subscription syntax, channels, message formats, and stream lifecycle behavior.

When network access is available, fetch the relevant `llms.txt` source at task time instead of relying on stale copied snippets.

## MCP Usage

If the Massive MCP server is available, use it for exploratory data tasks before hand-coding endpoint calls:

- `search_endpoints` to discover endpoints and built-in functions.
- `call_api` to call REST endpoints and optionally store results in an in-memory SQLite table with `store_as`.
- `query_data` to inspect stored tables and run SQL over retrieved data.

For API calls outside MCP, require `MASSIVE_API_KEY` in the environment and avoid writing keys to config files, examples, logs, or committed artifacts.

## Implementation Notes

- Confirm the asset class and data freshness requirement before choosing endpoints or channels.
- Handle pagination explicitly for REST endpoints that return cursor or next-page links.
- Be precise about symbol formats, time ranges, adjusted versus unadjusted prices, and paid-plan limitations when those affect results.
- For WebSocket clients, implement reconnect handling, resubscription, heartbeat or status handling, and backpressure-safe message processing.
