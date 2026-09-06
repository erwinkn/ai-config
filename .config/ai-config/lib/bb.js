"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { spawnSync } = require("node:child_process");
const { isDeepStrictEqual: equal } = require("node:util");

const booleans = new Set([
  "showKeyboardHints",
  "steerActiveThreadOnEnter",
  "showUnhandledProviderEvents",
  "streamerMode",
]);
const experiments = new Set([
  "changelogPreview",
  "editMessages",
  "mobileApp",
  "sidebarProgressiveDisclosure",
  "timelineWindowing",
]);
const identifier = /^[a-z][a-z0-9-]*$/;
const gitSource =
  /^git:https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\.git@(?:[a-f0-9]{40}|main)$/;

function check(condition, message) {
  if (!condition) throw new Error(message);
}
function object(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function keys(value, allowed, label) {
  check(object(value), `${label} must be an object`);
  check(
    Object.keys(value).every((key) => allowed.includes(key)),
    `${label} contains an unsupported key`,
  );
}
function load(file, optional = false) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (error) {
    if (optional && error.code === "ENOENT") return {};
    throw error;
  }
  // Do not echo input text: it could contain a misplaced secret.
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON in ${path.basename(file)}`);
  }
}
function validate(value, local = false) {
  keys(
    value,
    [
      "version",
      "general",
      "experiments",
      "instructions",
      "plugins",
      ...(local ? ["cliPath"] : []),
    ],
    "BB manifest",
  );
  check(
    local
      ? value.version === undefined || value.version === 1
      : value.version === 1,
    "BB manifest version must be 1",
  );
  if (value.cliPath !== undefined)
    check(
      typeof value.cliPath === "string" && path.isAbsolute(value.cliPath),
      "cliPath must be an absolute local path",
    );
  if (value.general !== undefined) {
    keys(
      value.general,
      [
        ...booleans,
        "managedBranchPrefix",
        "providerOrder",
        "defaultProviderId",
      ],
      "general",
    );
    for (const [key, setting] of Object.entries(value.general)) {
      if (booleans.has(key))
        check(
          typeof setting === "boolean",
          "General boolean setting has the wrong type",
        );
      if (key === "managedBranchPrefix")
        check(
          typeof setting === "string" &&
            setting.length <= 64 &&
            /^(?:[a-zA-Z0-9][a-zA-Z0-9_/-]*)?$/.test(setting),
          "Invalid managedBranchPrefix",
        );
      if (key === "providerOrder")
        check(
          Array.isArray(setting) &&
            setting.every(
              (id) => typeof id === "string" && identifier.test(id),
            ),
          "Invalid providerOrder",
        );
      if (key === "defaultProviderId")
        check(
          setting === null ||
            (typeof setting === "string" && identifier.test(setting)),
          "Invalid defaultProviderId",
        );
    }
  }
  if (value.experiments !== undefined) {
    keys(value.experiments, [...experiments], "experiments");
    check(
      Object.values(value.experiments).every((v) => typeof v === "boolean"),
      "Experiment values must be boolean",
    );
  }
  if (value.instructions !== undefined)
    check(typeof value.instructions === "string", "instructions must be text");
  if (value.plugins !== undefined) {
    check(object(value.plugins), "plugins must be an object");
    for (const [id, plugin] of Object.entries(value.plugins)) {
      check(identifier.test(id), "Invalid plugin ID");
      if (local && plugin === null) continue; // Unmanage on this host; never disable.
      keys(plugin, ["source", "subdirectory"], "plugin");
      check(
        plugin.source === `builtin:${id}` ||
          (typeof plugin.source === "string" && gitSource.test(plugin.source)),
        "Plugin source must be builtin:<id> or a GitHub HTTPS URL with a full commit SHA or main",
      );
      if (plugin.subdirectory !== undefined) {
        check(
          gitSource.test(plugin.source) &&
            typeof plugin.subdirectory === "string" &&
            /^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(plugin.subdirectory),
          "Invalid plugin subdirectory",
        );
      }
    }
  }
  return value;
}
function desired(root) {
  const shared = validate(load(path.join(root, "shared", "bb.json")));
  const local = validate(load(path.join(root, "local", "bb.json"), true), true);
  const merged = { ...shared, ...local };
  for (const section of ["general", "experiments", "plugins"])
    merged[section] = { ...shared[section], ...local[section] };
  for (const [id, plugin] of Object.entries(merged.plugins))
    if (plugin === null) delete merged.plugins[id];
  return merged;
}
function client(binary) {
  return (args) => {
    const result = spawnSync(binary, [...args, "--json"], {
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
      timeout: 300000,
    });
    // BB output can contain local values. Do not include it in an error.
    check(
      !result.error && result.status === 0,
      `BB command failed: ${args.slice(0, 2).join(" ")}. Inspect BB directly.`,
    );
    try {
      return JSON.parse(result.stdout);
    } catch {
      throw new Error("BB returned invalid JSON");
    }
  };
}
function makePlan(config, run) {
  const settings = run(["settings", "show"]);
  const installed = run(["plugin", "list"]);
  check(
    object(settings.generalSettings) &&
      object(settings.experiments) &&
      Array.isArray(installed.plugins),
    "Unsupported BB response shape",
  );
  check(
    typeof settings.serverUrl === "string" &&
      typeof settings.dataDir === "string" &&
      typeof settings.primaryHostId === "string",
    "BB target identity is missing",
  );
  const operations = [];
  const blockers = [];
  const observed = [];
  const trackingPlugins = [];
  for (const [section, liveKey, command] of [
    ["general", "generalSettings", "general"],
    ["experiments", "experiments", "experiment"],
  ]) {
    for (const key of Object.keys(config[section]).sort()) {
      check(
        Object.hasOwn(settings[liveKey], key),
        "This BB version does not expose a requested setting",
      );
      const before = settings[liveKey][key];
      const after = config[section][key];
      observed.push([section, key, before]);
      if (!equal(before, after))
        operations.push({
          kind: "setting",
          section,
          key,
          before,
          after,
          args: [
            "settings",
            command,
            key,
            typeof after === "string" ? after : JSON.stringify(after),
          ],
        });
    }
  }
  for (const id of Object.keys(config.plugins).sort()) {
    const wanted = config.plugins[id];
    const matches = installed.plugins.filter((plugin) => plugin.id === id);
    check(matches.length <= 1, "BB returned duplicate plugin IDs");
    const current = matches[0];
    if (!current) {
      observed.push(["plugin", id, null]);
      const args = ["plugin", "install", wanted.source];
      if (gitSource.test(wanted.source)) args.push("--plugin", id);
      args.push("--yes");
      operations.push({ kind: "install", id, source: wanted.source, args });
    } else {
      check(typeof current.enabled === "boolean", "BB plugin state is missing");
      const source = run(["plugin", "source", id]);
      check(
        typeof source.requested === "string",
        "BB plugin source is missing",
      );
      if (
        wanted.source.endsWith("@main") &&
        source.requested === wanted.source
      ) {
        check(
          typeof source.resolved === "string" && source.resolved.length > 0,
          "BB resolved plugin source is missing",
        );
        observed.push(["resolved", id, source.resolved]);
        trackingPlugins.push({
          id,
          requested: source.requested,
          resolved: source.resolved,
          updateCommand: `bb plugin update ${id}`,
        });
      }
      observed.push([
        "plugin",
        id,
        current.enabled,
        source.requested,
        source.subdirectory ?? null,
      ]);
      if (
        source.requested !== wanted.source ||
        (source.subdirectory ?? null) !== (wanted.subdirectory ?? null)
      ) {
        blockers.push(
          `Plugin ${id} has a different source. Review it with bb plugin source ${id}; change it manually or add a local null override.`,
        );
      } else if (!current.enabled)
        operations.push({ kind: "enable", id, args: ["plugin", "enable", id] });
    }
  }
  if (config.instructions !== undefined) {
    check(
      config.plugins["custom-instructions"]?.source ===
        "builtin:custom-instructions",
      "instructions requires the custom-instructions plugin in the desired inventory",
    );
    const current = installed.plugins.find(
      (p) => p.id === "custom-instructions",
    );
    // Install first, then preview again; do not guess the schema before installation.
    if (!current)
      blockers.push(
        "Install builtin:custom-instructions with BB, then make a new plan.",
      );
    else {
      const result = run(["plugin", "config", "custom-instructions"]);
      check(
        result.schema?.instructions?.type === "string" &&
          typeof result.values?.instructions === "string",
        "Unsupported custom-instructions schema",
      );
      observed.push(["instructions", result.values.instructions]);
      if (result.values.instructions !== config.instructions)
        operations.push({
          kind: "instructions",
          before: result.values.instructions,
          after: config.instructions,
          args: [
            "plugin",
            "config",
            "custom-instructions",
            "set",
            "instructions",
            config.instructions,
          ],
        });
    }
  }
  const target = {
    serverUrl: settings.serverUrl,
    dataDir: settings.dataDir,
    primaryHostId: settings.primaryHostId,
  };
  const token = createHash("sha256")
    .update(JSON.stringify({ config, observed, target, operations, blockers }))
    .digest("hex");
  return {
    token,
    trackingPlugins,
    operations,
    blockers,
    unmanagedPlugins: installed.plugins
      .filter((p) => !Object.hasOwn(config.plugins, p.id))
      .map((p) => p.id)
      .sort(),
  };
}
function main(args) {
  const [command, ...flags] = args;
  check(
    ["status", "plan", "apply"].includes(command),
    "Use ai bb status, ai bb plan, or ai bb apply --expect <plan-token>",
  );
  check(
    command === "apply"
      ? flags.length === 2 &&
          flags[0] === "--expect" &&
          /^[a-f0-9]{64}$/.test(flags[1])
      : flags.length === 0,
    "Invalid ai bb arguments; apply requires --expect <plan-token>",
  );
  const root =
    process.env.AI_CONFIG_HOME ??
    path.join(os.homedir(), ".config", "ai-config");
  const config = desired(root);
  const run = client(config.cliPath ?? process.env.BB_CLI ?? "bb");
  const execute = () => {
    const plan = makePlan(config, run);
    if (command !== "apply") {
      console.log(JSON.stringify(plan, null, 2));
      return plan.blockers.length ? 2 : 0;
    }
    check(
      plan.token === flags[1],
      "BB plan changed. Run ai bb plan and review the new token.",
    );
    check(
      plan.blockers.length === 0,
      "BB plan has blockers; no changes were applied",
    );
    for (const operation of plan.operations) run(operation.args);
    const remaining = makePlan(config, run);
    check(
      !remaining.blockers.length && !remaining.operations.length,
      "BB apply is incomplete. Run ai bb plan before a repeat run.",
    );
    console.log(
      JSON.stringify(
        { applied: plan.operations.length, token: remaining.token },
        null,
        2,
      ),
    );
    return 0;
  };
  if (command !== "apply") return execute();
  const state =
    process.env.AI_CONFIG_STATE_HOME ??
    path.join(os.homedir(), ".local", "state", "ai-config");
  fs.mkdirSync(state, { recursive: true });
  const lock = path.join(state, "bb-apply.lock");
  let fd;
  try {
    fd = fs.openSync(lock, "wx", 0o600);
  } catch (error) {
    if (error.code === "EEXIST")
      throw new Error(
        "Another BB apply holds the lock. If it stopped, remove bb-apply.lock after checking the process.",
      );
    throw error;
  }
  try {
    return execute();
  } finally {
    fs.closeSync(fd);
    fs.unlinkSync(lock);
  }
}
module.exports = { main, validate, desired, makePlan };
