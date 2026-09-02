# Massive Documentation Sources

Use these live `llms.txt` sources when working with Massive.com APIs:

- REST API: `https://massive.com/docs/rest/llms.txt`
- Real-time WebSocket API: `https://massive.com/docs/websocket/llms.txt`

Selection guide:

- Read the REST source for HTTP endpoints, endpoint discovery, request and query parameters, response schemas, pagination, snapshots, historical aggregates, trades, quotes, fundamentals, news, reference data, market status, and examples.
- Read the WebSocket source for real-time connection URLs, authentication, subscription and unsubscription messages, channel names, event schemas, status messages, reconnect behavior, and streaming examples.

Operational notes:

- Prefer fetching these URLs at task time so answers track the current docs.
- Treat `MASSIVE_API_KEY` as required for live calls.
- Do not commit API keys or paste them into examples.
