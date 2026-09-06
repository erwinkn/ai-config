"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { validate, makePlan } = require("../lib/bb");
const ai = path.resolve(__dirname, "../bin/ai");
const pin = `git:https://github.com/owner/repo.git@${"a".repeat(40)}`;

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-bb-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, "shared"));
  fs.mkdirSync(path.join(root, "local"));
  const stateFile = path.join(root, "fake-state.json");
  const logFile = path.join(root, "calls.jsonl");
  const binary = path.join(root, "fake-bb");
  fs.writeFileSync(
    binary,
    `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2, -1);
const file = process.env.FAKE_STATE;
const s = JSON.parse(fs.readFileSync(file));
fs.appendFileSync(process.env.FAKE_LOG, JSON.stringify(args) + '\\n');
let result = {};
if (args[0] === 'settings' && args[1] === 'show') result = s.settings;
else if (args[0] === 'settings') {
 const group = args[1] === 'general' ? 'generalSettings' : 'experiments';
 s.settings[group][args[2]] = JSON.parse(args[3]);
} else if (args[1] === 'list') result = {plugins: s.plugins};
else if (args[1] === 'source') result = s.sources[args[2]];
else if (args[1] === 'install') {
 s.plugins.push({id: 'sample', enabled: true});
 s.sources.sample = {requested: args[2], resolved: "installed-commit-a", subdirectory: args.includes('--plugin') && args[args.indexOf('--plugin') + 1] === 'sample' ? 'plugins/sample' : null};
} else if (args[1] === 'enable') s.plugins.find(p => p.id === args[2]).enabled = true;
else if (args[1] === 'config' && args.length === 3) result = {schema:{instructions:{type:'string'}},values:{instructions:s.instructions}};
else if (args[1] === 'config') s.instructions = args[5];
else process.exit(4);
if (s.failMutation && args[0] === 'settings' && args[1] !== 'show') process.exit(5);
fs.writeFileSync(file, JSON.stringify(s));
console.log(JSON.stringify(result));
`,
    { mode: 0o755 },
  );
  const state = {
    settings: {
      generalSettings: {
        showKeyboardHints: false,
        streamerMode: true,
        unknownPreference: "preserve",
      },
      experiments: { mobileApp: false },
      serverUrl: "http://127.0.0.1:38886",
      dataDir: "/fake/bb",
      primaryHostId: "host_test",
    },
    plugins: [
      { id: "unmanaged", enabled: false },
      { id: "custom-instructions", enabled: true },
    ],
    sources: {
      "custom-instructions": { requested: "builtin:custom-instructions" },
    },
    instructions: "old instructions",
  };
  const config = {
    version: 1,
    general: { showKeyboardHints: true },
    instructions: "new instructions",
    plugins: {
      "custom-instructions": { source: "builtin:custom-instructions" },
      sample: { source: pin, subdirectory: "plugins/sample" },
    },
  };
  const save = () => {
    fs.writeFileSync(stateFile, JSON.stringify(state));
    fs.writeFileSync(path.join(root, "shared/bb.json"), JSON.stringify(config));
  };
  save();
  const run = (...args) =>
    spawnSync(process.execPath, [ai, "bb", ...args], {
      encoding: "utf8",
      env: {
        ...process.env,
        AI_CONFIG_HOME: root,
        AI_CONFIG_STATE_HOME: path.join(root, "state"),
        BB_CLI: binary,
        FAKE_STATE: stateFile,
        FAKE_LOG: logFile,
      },
    });
  const calls = () =>
    fs.readFileSync(logFile, "utf8").trim().split("\n").map(JSON.parse);
  return {
    root,
    state,
    config,
    save,
    run,
    calls,
    read: () => JSON.parse(fs.readFileSync(stateFile)),
  };
}

test("plan is read-only; explicit apply preserves unrelated state; repeat is empty", (t) => {
  const f = fixture(t);
  const preview = f.run("plan");
  assert.equal(preview.status, 0, preview.stderr);
  const plan = JSON.parse(preview.stdout);
  assert.deepEqual(f.read(), f.state);
  assert.ok(
    f
      .calls()
      .every(
        (a) =>
          ["show", "list", "source", "config"].includes(a[1]) && a.length <= 3,
      ),
  );
  assert.equal(f.run("apply").status, 1);
  const applied = f.run("apply", "--expect", plan.token);
  assert.equal(applied.status, 0, applied.stderr);
  assert.deepEqual(
    f.calls().find((a) => a[1] === "install"),
    ["plugin", "install", pin, "--plugin", "sample", "--yes"],
  );
  const live = f.read();
  assert.equal(live.settings.generalSettings.unknownPreference, "preserve");
  assert.equal(live.settings.generalSettings.streamerMode, true);
  assert.deepEqual(
    live.plugins.find((p) => p.id === "unmanaged"),
    { id: "unmanaged", enabled: false },
  );
  assert.equal(live.instructions, "new instructions");
  const again = JSON.parse(f.run("plan").stdout);
  assert.deepEqual(again.operations, []);
  assert.equal(
    JSON.parse(f.run("apply", "--expect", again.token).stdout).applied,
    0,
  );
  assert.ok(
    !f
      .calls()
      .some((a) => ["remove", "disable", "update", "reload"].includes(a[1])),
  );
});

test("changed live state, desired state and target invalidate the preview", (t) => {
  for (const change of [
    (f) => {
      f.state.settings.generalSettings.showKeyboardHints = true;
    },
    (f) => {
      f.config.general.showKeyboardHints = false;
    },
    (f) => {
      f.state.settings.primaryHostId = "other";
    },
  ]) {
    const f = fixture(t);
    const plan = JSON.parse(f.run("plan").stdout);
    change(f);
    f.save();
    const result = f.run("apply", "--expect", plan.token);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /plan changed/);
    assert.deepEqual(f.read(), f.state);
  }
});

test("source and subdirectory conflicts block all mutations", (t) => {
  for (const source of [
    { requested: pin, subdirectory: "wrong" },
    { requested: "path:/private/plugin", subdirectory: "plugins/sample" },
  ]) {
    const f = fixture(t);
    f.state.plugins.push({ id: "sample", enabled: true });
    f.state.sources.sample = source;
    f.save();
    const result = f.run("plan");
    assert.equal(result.status, 2);
    const plan = JSON.parse(result.stdout);
    assert.equal(plan.blockers.length, 1);
    assert.equal(f.run("apply", "--expect", plan.token).status, 1);
    assert.deepEqual(f.read(), f.state);
  }
});

test("local settings override shared values; null plugin means unmanaged", (t) => {
  const f = fixture(t);
  fs.writeFileSync(
    path.join(f.root, "local/bb.json"),
    JSON.stringify({
      general: { showKeyboardHints: false },
      plugins: { sample: null },
    }),
  );
  const plan = JSON.parse(f.run("status").stdout);
  assert.ok(
    !plan.operations.some((o) => o.kind === "install" || o.kind === "setting"),
  );
});

test("reject hostile manifests before BB runs; do not print input secrets", (t) => {
  const invalid = [
    { machineCredential: "PRIVATE_SENTINEL" },
    { general: { unknown: true } },
    { general: { showKeyboardHints: "true" } },
    {
      plugins: {
        sample: {
          source: "git:https://user:PRIVATE_SENTINEL@github.com/o/r.git@main",
        },
      },
    },
    { plugins: { sample: { source: pin, subdirectory: "../escape" } } },
    { plugins: { sample: { source: "$(touch /tmp/unsafe)" } } },
    { plugins: { sample: { source: pin, enabled: false } } },
    JSON.parse('{"__proto__":{"polluted":true}}'),
    { cliPath: "/tmp/not-shared" },
  ];
  for (const extra of invalid) {
    const f = fixture(t);
    fs.writeFileSync(
      path.join(f.root, "shared/bb.json"),
      JSON.stringify({ version: 1, ...extra }),
    );
    const result = f.run("plan");
    assert.equal(result.status, 1);
    assert.ok(!result.stderr.includes("PRIVATE_SENTINEL"));
    assert.ok(!fs.existsSync(path.join(f.root, "calls.jsonl")));
  }
  const f = fixture(t);
  fs.writeFileSync(
    path.join(f.root, "shared/bb.json"),
    '{"secret":"PRIVATE_SENTINEL',
  );
  const r = f.run("plan");
  assert.equal(r.status, 1);
  assert.ok(!r.stderr.includes("PRIVATE_SENTINEL"));
});

test("failures stop apply and release its lock", (t) => {
  const f = fixture(t);
  f.state.failMutation = true;
  f.save();
  const plan = JSON.parse(f.run("plan").stdout);
  const r = f.run("apply", "--expect", plan.token);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /BB command failed/);
  assert.ok(!fs.existsSync(path.join(f.root, "state/bb-apply.lock")));
  assert.ok(!f.calls().some((a) => a[1] === "install"));
});

test("unsupported BB response fails closed", () => {
  assert.throws(
    () => makePlan({ general: {}, experiments: {}, plugins: {} }, () => ({})),
    /response shape/,
  );
});

test("shared inventory is portable and excludes runtime data", () => {
  const raw = fs.readFileSync(
    path.resolve(__dirname, "../shared/bb.json"),
    "utf8",
  );
  const config = validate(JSON.parse(raw));
  assert.doesNotMatch(
    raw,
    /\/Users\/|\/home\/|host_|thr_|env_|machineCredential|env\.json|erwin-hello|erwin-provider-branding|devin-branding/,
  );
  assert.ok(config.plugins["provider-codex"]);
});

test("disabled desired plugin is enabled without changing its source", (t) => {
  const f = fixture(t);
  f.state.plugins.push({ id: "sample", enabled: false });
  f.state.sources.sample = {
    requested: f.config.plugins.sample.source,
    subdirectory: "plugins/sample",
  };
  f.save();
  const plan = JSON.parse(f.run("plan").stdout);
  assert.ok(
    plan.operations.some((o) => o.kind === "enable" && o.id === "sample"),
  );
  const result = f.run("apply", "--expect", plan.token);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(!f.calls().some((a) => a[1] === "install"));
  assert.equal(f.read().plugins.find((p) => p.id === "sample").enabled, true);
});

test("apply lock blocks writes and is not removed by another run", (t) => {
  const f = fixture(t);
  const plan = JSON.parse(f.run("plan").stdout);
  fs.mkdirSync(path.join(f.root, "state"));
  const lock = path.join(f.root, "state/bb-apply.lock");
  fs.writeFileSync(lock, "other process");
  assert.equal(f.run("apply", "--expect", plan.token).status, 1);
  assert.equal(fs.readFileSync(lock, "utf8"), "other process");
  assert.deepEqual(f.read(), f.state);
});

test("instruction text stays literal and active files stay untouched", (t) => {
  const f = fixture(t);
  const marker = path.join(f.root, "must-not-exist");
  f.config.instructions = `Keep this literal: $(touch ${marker}); \`touch ${marker}\``;
  f.save();
  const files = [
    ".bb/config.json",
    ".bb/env.json",
    ".codex/config.toml",
    ".claude/settings.json",
    ".ai-config/config",
  ];
  for (const file of files) {
    const target = path.join(f.root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, "preserve byte for byte");
  }
  const plan = JSON.parse(f.run("plan").stdout);
  const result = f.run("apply", "--expect", plan.token);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(f.read().instructions, f.config.instructions);
  assert.ok(!fs.existsSync(marker));
  for (const file of files)
    assert.equal(
      fs.readFileSync(path.join(f.root, file), "utf8"),
      "preserve byte for byte",
    );
});

test("main installs with the plugin selector and reports the resolved source", (t) => {
  const f = fixture(t);
  f.config.plugins.sample.source = pin.replace(/@[a-f0-9]{40}$/, "@main");
  f.save();
  const preview = f.run("plan");
  assert.equal(preview.status, 0, preview.stderr);
  const result = f.run("apply", "--expect", JSON.parse(preview.stdout).token);
  assert.equal(result.status, 0, result.stderr);
  const plan = JSON.parse(f.run("plan").stdout);
  assert.deepEqual(plan.operations, []);
  assert.deepEqual(plan.trackingPlugins, [
    {
      id: "sample",
      requested: f.config.plugins.sample.source,
      resolved: "installed-commit-a",
      updateCommand: "bb plugin update sample",
    },
  ]);
  assert.ok(!f.calls().some((a) => a[1] === "update" || a[1] === "outdated"));
});

test("a main plugin update invalidates the preview without automatic updates", (t) => {
  const f = fixture(t);
  f.config.plugins.sample.source = pin.replace(/@[a-f0-9]{40}$/, "@main");
  f.state.plugins.push({ id: "sample", enabled: true });
  f.state.sources.sample = {
    requested: f.config.plugins.sample.source,
    resolved: "commit-a",
    subdirectory: "plugins/sample",
  };
  f.save();
  const plan = JSON.parse(f.run("plan").stdout);
  f.state.sources.sample.resolved = "commit-b";
  f.save();
  const result = f.run("apply", "--expect", plan.token);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /plan changed/);
  assert.deepEqual(f.read(), f.state);
  assert.ok(!f.calls().some((a) => a[1] === "update"));
});

test("main requires resolved state and still blocks an existing pinned source", (t) => {
  const f = fixture(t);
  f.config.plugins.sample.source = pin.replace(/@[a-f0-9]{40}$/, "@main");
  f.state.plugins.push({ id: "sample", enabled: true });
  f.state.sources.sample = {
    requested: f.config.plugins.sample.source,
    subdirectory: "plugins/sample",
  };
  f.save();
  assert.equal(f.run("plan").status, 1);
  f.state.sources.sample.requested = pin;
  f.state.sources.sample.resolved = "commit-a";
  f.save();
  const result = f.run("plan");
  assert.equal(result.status, 2);
  assert.equal(JSON.parse(result.stdout).blockers.length, 1);
  assert.deepEqual(JSON.parse(result.stdout).trackingPlugins, []);
  assert.deepEqual(f.read(), f.state);
});

test("moving refs other than main remain unsupported", () => {
  for (const ref of ["develop", "latest", "v1.0.0", "main;echo", "../main"]) {
    assert.throws(
      () =>
        validate({
          version: 1,
          plugins: {
            sample: { source: pin.replace(/@[a-f0-9]{40}$/, `@${ref}`) },
          },
        }),
      /Plugin source/,
    );
  }
});
