(() => {
  const base = "/api/v1/symbols_list/custom";

  async function request(path, options = {}) {
    const { headers = {}, ...requestOptions } = options;
    const response = await fetch(path, {
      credentials: "include",
      ...requestOptions,
      headers: { "content-type": "application/json", ...headers },
    });
    const text = await response.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    if (!response.ok) throw new Error(`${response.status} ${JSON.stringify(body)}`);
    return body;
  }

  function validateItems(items) {
    if (!Array.isArray(items) || items.some((item) => typeof item !== "string" || item.length === 0)) {
      throw new Error("Watchlist items must be non-empty strings");
    }
  }

  async function read(id) {
    return request(`${base}/${id}/?source=web`);
  }

  async function createEmpty(name) {
    if (typeof name !== "string" || name.length === 0) throw new Error("Watchlist name is required");
    return request(`${base}/?source=web`, {
      method: "POST",
      body: JSON.stringify({ name, symbols: [] }),
    });
  }

  async function append(id, items) {
    validateItems(items);
    return request(`${base}/${id}/append/?source=web`, {
      method: "POST",
      body: JSON.stringify(items),
    });
  }

  async function replaceSymbol(id, oldSymbol, newSymbol) {
    return request(`${base}/${id}/replace_symbol/?source=web`, {
      method: "POST",
      body: JSON.stringify({ old: oldSymbol, new: newSymbol }),
    });
  }

  window.CodexTradingViewWatchlists = { read, createEmpty, append, replaceSymbol };
  return { ready: true };
})();
