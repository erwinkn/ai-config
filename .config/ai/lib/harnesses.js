"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { isDeepStrictEqual: equal } = require("node:util");
const toml = require("smol-toml");

// Only portable settings belong here. Native credential files are never opened.
const targets = {
  "claude-mcp": [".claude.json", "mcpServers"],
  cursor: [".cursor/mcp.json", "mcpServers"],
  devin: [".config/devin/mcp_config.json", "mcpServers"],
  opencode: [".config/opencode/opencode.json", "mcp"],
  grok: [".grok/config.toml", "mcp_servers"],
};
const uiTypes = {
  max_thoughts_width: "number",
  fork_secondary_model: "string",
  yolo: "boolean",
  compact_mode: "boolean",
};
const object = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const own = (v, k) => Object.hasOwn(v, k);
function check(ok, message) { if (!ok) throw new Error(message); }
function read(file) {
  if (!fs.existsSync(file)) return {};
  try {
    const text = fs.readFileSync(file, "utf8");
    const value = file.endsWith(".toml") ? toml.parse(text) : JSON.parse(text);
    check(object(value), "Expected object");
    return value;
  } catch {
    // Parse errors can include source text containing credentials.
    throw new Error(`Cannot parse configuration: ${file}`);
  }
}
function paths(tool) {
  check(own(targets, tool), "Unknown harness. Use claude-mcp, cursor, devin, opencode, or grok.");
  const root = process.env.AI_CONFIG_HOME ?? path.join(os.homedir(), ".config/ai");
  const home = process.env.AI_CONFIG_ACTIVE_HOME ?? os.homedir();
  const state = process.env.AI_CONFIG_STATE_HOME ?? path.join(os.homedir(), ".local/state/ai");
  return {
    shared: path.join(root, "shared/harnesses", `${tool}.json`),
    active: path.join(home, targets[tool][0]),
    snapshot: path.join(state, "harnesses", `${tool}.json`),
  };
}

function validate(tool, value) {
  const section = targets[tool][1];
  check(object(value), `Invalid shared configuration for ${tool}.`);
  check(Object.keys(value).every(k => k === section || (tool === "grok" && k === "ui")),
    `Unsupported shared section for ${tool}.`);
  if (own(value, section)) {
    check(object(value[section]), `Invalid MCP map for ${tool}.`);
    for (const [name, server] of Object.entries(value[section])) {
      check(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(name), `Invalid MCP name for ${tool}.`);
      const allowed = tool === "claude-mcp" ? ["url", "type"]
        : tool === "devin" ? ["url", "transport"]
        : tool === "opencode" ? ["url", "type", "enabled"]
        : tool === "grok" ? ["url", "enabled"] : ["url"];
      check(object(server) && Object.keys(server).every(k => allowed.includes(k)),
        `Unsupported MCP fields for ${tool}; credentials and local commands cannot be shared.`);
      let url;
      try { url = new URL(server.url); } catch { /* Checked below without printing input. */ }
      check(typeof server.url === "string" && url?.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash,
        `MCP URLs for ${tool} must use HTTPS without credentials, query parameters, or fragments.`);
      check(!own(server, "type") || server.type === (tool === "opencode" ? "remote" : "http"), `Invalid MCP type for ${tool}.`);
      check(!own(server, "transport") || server.transport === "http", `Invalid MCP transport for ${tool}.`);
      check(!own(server, "enabled") || typeof server.enabled === "boolean", `Invalid MCP enabled value for ${tool}.`);
    }
  }
  if (own(value, "ui")) {
    check(object(value.ui), "Invalid Grok UI settings.");
    for (const [key, entry] of Object.entries(value.ui)) {
      check(own(uiTypes, key) && typeof entry === uiTypes[key], "Unsupported Grok UI setting.");
    }
  }
  return value;
}

// Own individual server entries and UI preferences, not the entire native file.
function entries(value) {
  return Object.entries(value).flatMap(([section, values]) =>
    Object.entries(values).map(([key, entry]) => [section, key, entry]));
}
function prepare(tool) {
  const files = paths(tool);
  if (!fs.existsSync(files.shared)) return null;
  const desired = validate(tool, read(files.shared));
  const previous = validate(tool, read(files.snapshot));
  const current = read(files.active);
  const result = structuredClone(current);
  const keys = new Map([...entries(previous), ...entries(desired)].map(([s, k]) => [`${s}/${k}`, [s, k]]));
  for (const [section, key] of keys.values()) {
    check(!own(current, section) || object(current[section]), `Invalid native section for ${tool}.`);
    const now = own(current[section] ?? {}, key) ? current[section][key] : undefined;
    const before = own(previous[section] ?? {}, key) ? previous[section][key] : undefined;
    const next = own(desired[section] ?? {}, key) ? desired[section][key] : undefined;
    check(equal(now, next) || equal(now, before),
      `Local ${tool} configuration differs at ${section}.${key}. Use ai harness share ${tool} to promote supported settings, or resolve the field locally.`);
    if (next === undefined) {
      if (result[section]) delete result[section][key];
    } else {
      result[section] ??= {};
      result[section][key] = next;
    }
  }
  return { tool, files, desired, current, result,
    text: files.active.endsWith(".toml") ? toml.stringify(result) : `${JSON.stringify(result, null, 2)}\n` };
}

function prepareAll() { return Object.keys(targets).map(prepare).filter(Boolean); }
function apply(plans, atomicWrite) {
  // Refuse concurrent native edits before writing any of these files.
  for (const plan of plans) check(equal(read(plan.files.active), plan.current), `Configuration changed during apply: ${plan.tool}`);
  for (const plan of plans) {
    if (!equal(plan.current, plan.result)) {
      // Recheck under the ai write lock after preparing the temporary file,
      // immediately before replacement. Native apps do not share our lock.
      atomicWrite(plan.files.active, plan.text, 0o600, () => {
        check(equal(read(plan.files.active), plan.current), `Configuration changed during apply: ${plan.tool}`);
      });
    }
    atomicWrite(plan.files.snapshot, `${JSON.stringify(plan.desired, null, 2)}\n`);
  }
}
function status() {
  for (const tool of Object.keys(targets)) {
    try {
      const plan = prepare(tool);
      if (plan) console.log(`  ${tool}  ${equal(plan.current, plan.result) ? "current" : "pending"}`);
    } catch (error) { console.log(`  ${tool}  ${error.message}`); }
  }
}
function share(tool, atomicWrite) {
  const files = paths(tool);
  check(fs.existsSync(files.active), `No native configuration for ${tool}.`);
  const native = read(files.active);
  const section = targets[tool][1];
  const fragment = { [section]: native[section] ?? {} };
  if (tool === "grok" && object(native.ui)) {
    fragment.ui = Object.fromEntries(Object.entries(native.ui).filter(([k]) => own(uiTypes, k)));
  }
  validate(tool, fragment);
  atomicWrite(files.shared, `${JSON.stringify(fragment, null, 2)}\n`, 0o644);
  console.log(`Shared supported ${tool} settings. Run ai apply to record the new baseline.`);
}

module.exports = { prepareAll, apply, status, share };
