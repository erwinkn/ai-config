"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const { parse, stringify } = require("smol-toml");

const ai = path.resolve(__dirname, "..", "bin", "ai");

function createFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-config-test."));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const home = path.join(root, "home");
  const config = path.join(root, "config");
  const state = path.join(root, "state");
  fs.mkdirSync(path.join(config, "shared"), { recursive: true });
  fs.writeFileSync(
    path.join(config, "shared", "claude.json"),
    `${JSON.stringify({ theme: "dark", plugins: { one: true, two: true } }, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(config, "shared", "codex.toml"),
    stringify({ model: "shared", agents: { count: 10 }, remove: { value: true } }),
  );
  return {
    root,
    home,
    config,
    state,
    env: {
      ...process.env,
      HOME: home,
      AI_CONFIG_HOME: config,
      AI_CONFIG_STATE_HOME: state,
      AI_CONFIG_ACTIVE_HOME: home,
      NO_COLOR: "1",
    },
  };
}

function run(fixture, args, options = {}) {
  const result = spawnSync(process.execPath, [ai, ...args], {
    cwd: options.cwd,
    env: fixture.env,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result;
}

function runFailure(fixture, args) {
  const result = spawnSync(process.execPath, [ai, ...args], {
    env: fixture.env,
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0, "Expected the command to fail");
  return result;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function readToml(file) {
  return parse(fs.readFileSync(file, "utf8"));
}

function writeHarness(f, tool, value) {
  const directory = path.join(f.config, "shared/harnesses");
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, `${tool}.json`), JSON.stringify(value));
}

function nativeJson(f, file, value) {
  const target = path.join(f.home, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(value));
  return target;
}

test("harness apply preserves native account state and unrelated servers across all targets", (t) => {
  const f = createFixture(t);
  const server = { url: "https://executor.example/mcp" };
  const targets = [
    ["claude-mcp", ".claude.json", "mcpServers", { ...server, type: "http" }],
    ["cursor", ".cursor/mcp.json", "mcpServers", server],
    ["devin", ".config/devin/mcp_config.json", "mcpServers", { ...server, transport: "http" }],
    ["opencode", ".config/opencode/opencode.json", "mcp", { ...server, type: "remote" }],
  ];
  for (const [tool, file, section, entry] of targets) {
    writeHarness(f, tool, { [section]: { executor: entry } });
    nativeJson(f, file, { account: { token: "PRIVATE_TEST_VALUE" }, projects: { a: {} },
      [section]: { local: { command: "local-tool", env: { KEY: "PRIVATE_TEST_VALUE" } } } });
  }
  writeHarness(f, "grok", { mcp_servers: { executor: { ...server, enabled: true } }, ui: { yolo: false } });
  const grok = path.join(f.home, ".grok/config.toml");
  fs.mkdirSync(path.dirname(grok), { recursive: true });
  fs.writeFileSync(grok, stringify({ ui: { compact_mode: true }, account: { token: "PRIVATE_TEST_VALUE" } }));
  run(f, ["apply"]);
  for (const [tool, file, section, entry] of targets) {
    const native = readJson(path.join(f.home, file));
    assert.deepEqual(native[section].executor, entry);
    assert.equal(native.account.token, "PRIVATE_TEST_VALUE");
    assert.equal(native[section].local.env.KEY, "PRIVATE_TEST_VALUE");
    assert.deepEqual(native.projects, { a: {} });
    assert.ok(!fs.readFileSync(path.join(f.state, "harnesses", `${tool}.json`), "utf8").includes("PRIVATE_TEST_VALUE"));
  }
  assert.deepEqual(readToml(grok).ui, { compact_mode: true, yolo: false });
  const before = fs.readFileSync(grok, "utf8");
  run(f, ["apply"]);
  assert.equal(fs.readFileSync(grok, "utf8"), before);
  // Native account churn does not count as managed configuration drift.
  const claude = readJson(path.join(f.home, ".claude.json"));
  claude.account.token = "CHANGED_PRIVATE_VALUE";
  nativeJson(f, ".claude.json", claude);
  run(f, ["apply"]);
  assert.equal(readJson(path.join(f.home, ".claude.json")).account.token, "CHANGED_PRIVATE_VALUE");
});

test("harness drift blocks all config writes and explicit share resolves it", (t) => {
  const f = createFixture(t);
  writeHarness(f, "cursor", { mcpServers: { executor: { url: "https://first.example/mcp" } } });
  run(f, ["apply"]);
  nativeJson(f, ".cursor/mcp.json", { mcpServers: { executor: { url: "https://second.example/mcp" } }, token: "PRIVATE_TEST_VALUE" });
  fs.writeFileSync(path.join(f.config, "shared/claude.json"), '{"theme":"new"}');
  const before = fs.readFileSync(path.join(f.home, ".claude/settings.json"), "utf8");
  assert.match(runFailure(f, ["apply"]).stderr, /Local cursor configuration differs/);
  assert.equal(fs.readFileSync(path.join(f.home, ".claude/settings.json"), "utf8"), before);
  run(f, ["harness", "share", "cursor"]);
  const shared = readJson(path.join(f.config, "shared/harnesses/cursor.json"));
  assert.deepEqual(shared, { mcpServers: { executor: { url: "https://second.example/mcp" } } });
  run(f, ["apply"]);
});

test("removing a managed harness entry preserves unrelated native entries", (t) => {
  const f = createFixture(t);
  writeHarness(f, "claude-mcp", { mcpServers: { executor: { type: "http", url: "https://executor.example/mcp" } } });
  const file = nativeJson(f, ".claude.json", { mcpServers: { local: { command: "private" } }, projects: { a: {} } });
  run(f, ["apply"]);
  writeHarness(f, "claude-mcp", {});
  run(f, ["apply"]);
  assert.deepEqual(readJson(file), { mcpServers: { local: { command: "private" } }, projects: { a: {} } });
});

test("native edits during temporary-file preparation abort replacement and retain the baseline", (t) => {
  const f = createFixture(t);
  const original = { mcpServers: { executor: { url: "https://first.example/mcp" } } };
  writeHarness(f, "cursor", original);
  run(f, ["apply"]);
  writeHarness(f, "cursor", { mcpServers: { executor: { url: "https://second.example/mcp" } } });
  const active = path.join(f.home, ".cursor/mcp.json");
  const concurrent = { ...original, account: { token: "CONCURRENT_PRIVATE_VALUE" } };
  const preload = path.join(f.root, "native-writer.cjs");
  fs.writeFileSync(preload, `
    const fs = require("node:fs");
    const path = require("node:path");
    const chmod = fs.chmodSync;
    fs.chmodSync = function(file, ...args) {
      chmod.call(this, file, ...args);
      if (path.basename(file).startsWith(".mcp.json.")) {
        fs.writeFileSync(${JSON.stringify(active)}, ${JSON.stringify(JSON.stringify(concurrent))});
      }
    };
  `);
  f.env.NODE_OPTIONS = `--require ${JSON.stringify(preload)}`;
  const result = runFailure(f, ["apply"]);
  assert.match(result.stderr, /Configuration changed during apply: cursor/);
  assert.ok(!result.stderr.includes("CONCURRENT_PRIVATE_VALUE"));
  assert.deepEqual(readJson(active), concurrent);
  assert.deepEqual(readJson(path.join(f.state, "harnesses/cursor.json")), original);
  assert.deepEqual(fs.readdirSync(path.dirname(active)), ["mcp.json"]);
});

test("harness sharing rejects credential fields and credential URLs without leaking values", (t) => {
  const f = createFixture(t);
  const original = { mcpServers: { executor: { url: "https://executor.example/mcp" } } };
  writeHarness(f, "cursor", original);
  for (const server of [
    { url: "https://executor.example/mcp", headers: { Authorization: "PRIVATE_TEST_VALUE" } },
    { url: "https://PRIVATE_TEST_VALUE@example.com/mcp" },
    { url: "https://example.com/mcp?token=PRIVATE_TEST_VALUE" },
    { url: "https://example.com/mcp#PRIVATE_TEST_VALUE" },
    { command: "PRIVATE_TEST_VALUE" },
  ]) {
    nativeJson(f, ".cursor/mcp.json", { mcpServers: { executor: server } });
    const result = runFailure(f, ["harness", "share", "cursor"]);
    assert.ok(!`${result.stdout}${result.stderr}`.includes("PRIVATE_TEST_VALUE"));
    assert.deepEqual(readJson(path.join(f.config, "shared/harnesses/cursor.json")), original);
  }
});

test("first harness apply rejects conflicts and malformed files before writes", (t) => {
  const f = createFixture(t);
  writeHarness(f, "cursor", { mcpServers: { executor: { url: "https://executor.example/mcp" } } });
  const file = nativeJson(f, ".cursor/mcp.json", { mcpServers: { executor: { command: "local" } } });
  assert.match(runFailure(f, ["apply"]).stderr, /Local cursor configuration differs/);
  assert.ok(!fs.existsSync(path.join(f.home, ".claude/settings.json")));
  fs.writeFileSync(file, '{"token":"PRIVATE_TEST_VALUE", broken');
  const result = runFailure(f, ["apply"]);
  assert.match(result.stderr, /Cannot parse configuration/);
  assert.ok(!result.stderr.includes("PRIVATE_TEST_VALUE"));
});

test("an explicit pin survives a later shared change", (t) => {
  const fixture = createFixture(t);
  run(fixture, ["apply"]);
  run(fixture, ["pin", "codex", "model", "--value", "shared"]);

  const sharedFile = path.join(fixture.config, "shared", "codex.toml");
  const shared = readToml(sharedFile);
  shared.model = "updated";
  fs.writeFileSync(sharedFile, stringify(shared));
  run(fixture, ["apply"]);

  assert.equal(readToml(path.join(fixture.config, "local", "codex.toml")).model, "shared");
  assert.equal(readToml(path.join(fixture.home, ".codex", "config.toml")).model, "shared");
});

test("pin supports current values and typed values", (t) => {
  const fixture = createFixture(t);
  run(fixture, ["apply"]);
  run(fixture, ["pin", "claude", "theme"]);
  run(fixture, ["pin", "codex", "agents", "count", "--json-value", "20"]);

  assert.equal(readJson(path.join(fixture.config, "local", "claude.json")).theme, "dark");
  assert.equal(readToml(path.join(fixture.config, "local", "codex.toml")).agents.count, 20);
});

test("an explicitly pinned object replaces the shared object", (t) => {
  const fixture = createFixture(t);
  run(fixture, ["apply"]);
  run(fixture, ["pin", "claude", "plugins", "--json-value", '{"one":false}']);

  const local = readJson(path.join(fixture.config, "local", "claude.json"));
  assert.deepEqual(local.__ai_config.replace, [["plugins"]]);
  assert.deepEqual(readJson(path.join(fixture.home, ".claude", "settings.json")).plugins, {
    one: false,
  });
});

test("remove and reset update explicit local intent", (t) => {
  const fixture = createFixture(t);
  run(fixture, ["apply"]);
  run(fixture, ["remove", "codex", "remove", "value"]);

  const localAfterDelete = readToml(path.join(fixture.config, "local", "codex.toml"));
  assert.deepEqual(localAfterDelete.__ai_config.delete, [["remove", "value"]]);
  assert.equal(readToml(path.join(fixture.home, ".codex", "config.toml")).remove, undefined);

  run(fixture, ["reset", "codex", "remove", "value"]);
  assert.equal(readToml(path.join(fixture.home, ".codex", "config.toml")).remove.value, true);
});

test("adoption records an active deletion and preserves an existing pin", (t) => {
  const fixture = createFixture(t);
  run(fixture, ["apply"]);
  run(fixture, ["pin", "claude", "theme", "--value", "dark"]);

  const activeFile = path.join(fixture.home, ".claude", "settings.json");
  const active = readJson(activeFile);
  delete active.plugins.one;
  fs.writeFileSync(activeFile, `${JSON.stringify(active, null, 2)}\n`);
  run(fixture, ["capture"]);

  const local = readJson(path.join(fixture.config, "local", "claude.json"));
  assert.equal(local.theme, "dark");
  assert.deepEqual(local.__ai_config.delete, [["plugins", "one"]]);
  assert.deepEqual(readJson(activeFile).plugins, { two: true });
});

test("first adoption does not infer deletions from an incomplete existing file", (t) => {
  const fixture = createFixture(t);
  const activeFile = path.join(fixture.home, ".claude", "settings.json");
  fs.mkdirSync(path.dirname(activeFile), { recursive: true });
  fs.writeFileSync(activeFile, `${JSON.stringify({ theme: "light" }, null, 2)}\n`);

  run(fixture, ["capture"]);

  const local = readJson(path.join(fixture.config, "local", "claude.json"));
  assert.deepEqual(local, { theme: "light" });
  assert.deepEqual(readJson(activeFile), {
    theme: "light",
    plugins: { one: true, two: true },
  });
});

test("share is the explicit promotion boundary", (t) => {
  const fixture = createFixture(t);
  run(fixture, ["apply"]);
  run(fixture, ["pin", "codex", "model", "--value", "local"]);

  assert.equal(readToml(path.join(fixture.config, "shared", "codex.toml")).model, "shared");
  run(fixture, ["share", "codex", "model"]);

  assert.equal(readToml(path.join(fixture.config, "shared", "codex.toml")).model, "local");
  assert.equal(readToml(path.join(fixture.config, "local", "codex.toml")).model, undefined);
  assert.equal(readToml(path.join(fixture.home, ".codex", "config.toml")).model, "local");
});

test("share can promote a local deletion", (t) => {
  const fixture = createFixture(t);
  run(fixture, ["apply"]);
  run(fixture, ["remove", "codex", "remove"]);
  run(fixture, ["share", "codex", "remove"]);

  assert.equal(readToml(path.join(fixture.config, "shared", "codex.toml")).remove, undefined);
  const local = readToml(path.join(fixture.config, "local", "codex.toml"));
  assert.equal(local.__ai_config, undefined);
});

test("apply refuses to overwrite uncaptured active changes", (t) => {
  const fixture = createFixture(t);
  run(fixture, ["apply"]);
  const activeClaude = path.join(fixture.home, ".claude", "settings.json");
  const activeCodex = path.join(fixture.home, ".codex", "config.toml");
  const changed = readJson(activeClaude);
  changed.theme = "light";
  fs.writeFileSync(activeClaude, `${JSON.stringify(changed, null, 2)}\n`);
  const codexBefore = fs.readFileSync(activeCodex, "utf8");

  const result = runFailure(fixture, ["apply"]);

  assert.match(result.stderr, /Run `ai capture`/);
  assert.equal(readJson(activeClaude).theme, "light");
  assert.equal(fs.readFileSync(activeCodex, "utf8"), codexBefore);
  assert.equal(fs.existsSync(path.join(fixture.state, "config.lock")), false);
});

test("a live process lock blocks a second configuration command", (t) => {
  const fixture = createFixture(t);
  const lock = path.join(fixture.state, "config.lock");
  fs.mkdirSync(path.dirname(lock), { recursive: true });
  fs.writeFileSync(
    lock,
    `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString(), token: "test" })}\n`,
  );

  const result = runFailure(fixture, ["apply"]);

  assert.match(result.stderr, new RegExp(`PID ${process.pid}`));
  assert.equal(fs.existsSync(lock), true);
});

test("a lock owned by a dead process is recovered", (t) => {
  const fixture = createFixture(t);
  const lock = path.join(fixture.state, "config.lock");
  fs.mkdirSync(path.dirname(lock), { recursive: true });
  fs.writeFileSync(
    lock,
    `${JSON.stringify({ pid: 2147483647, startedAt: new Date(0).toISOString(), token: "stale" })}\n`,
  );

  run(fixture, ["apply"]);

  assert.equal(fs.existsSync(lock), false);
});

test("status reports changes to every tracked repository file", (t) => {
  const fixture = createFixture(t);
  const gitDir = path.join(fixture.root, "mirror.git");
  fs.mkdirSync(path.join(fixture.home, ".codex"), { recursive: true });
  fs.writeFileSync(path.join(fixture.home, ".codex", "AGENTS.md"), "shared\n");
  const initialized = spawnSync("git", ["init", "--bare", gitDir], {
    encoding: "utf8",
  });
  assert.equal(initialized.status, 0, initialized.stderr);
  const runMirrorGit = (...args) => {
    const result = spawnSync(
      "git",
      [`--git-dir=${gitDir}`, `--work-tree=${fixture.home}`, ...args],
      { cwd: fixture.home, encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
  };
  runMirrorGit("add", ".codex/AGENTS.md");
  runMirrorGit(
    "-c",
    "user.name=Test",
    "-c",
    "user.email=test@example.com",
    "commit",
    "-m",
    "track agent guidance",
  );
  fs.writeFileSync(path.join(fixture.home, ".codex", "AGENTS.md"), "local\n");
  fs.writeFileSync(path.join(fixture.home, "untracked.txt"), "untracked\n");
  fixture.env.AI_CONFIG_GIT_DIR = gitDir;
  fixture.env.AI_CONFIG_WORK_TREE = fixture.home;

  const result = run(fixture, ["status"]);

  assert.match(
    result.stdout,
    /Tracked repository changes\n {2} M \.codex\/AGENTS\.md/,
  );
  assert.doesNotMatch(result.stdout, /untracked\.txt/);
});

test("diff reports active configuration values", (t) => {
  const fixture = createFixture(t);
  run(fixture, ["apply"]);

  const activeClaude = path.join(fixture.home, ".claude", "settings.json");
  const claude = readJson(activeClaude);
  claude.theme = "private-theme";
  fs.writeFileSync(activeClaude, `${JSON.stringify(claude, null, 2)}\n`);

  const activeCodex = path.join(fixture.home, ".codex", "config.toml");
  const codex = readToml(activeCodex);
  codex.model = "private-model";
  codex.new_setting = { nested: "private-value" };
  delete codex.remove.value;
  fs.writeFileSync(activeCodex, stringify(codex));

  const result = run(fixture, ["diff"]);

  assert.match(result.stdout, /Claude configuration\n {2}~ claude\.theme/);
  assert.match(result.stdout, / {4}- "dark"\n {4}\+ "private-theme"/);
  assert.match(result.stdout, /Codex configuration/);
  assert.match(result.stdout, /~ codex\.model/);
  assert.match(result.stdout, / {4}- "shared"\n {4}\+ "private-model"/);
  assert.match(
    result.stdout,
    /\+ codex\.new_setting\n {4}\+ \{"nested":"private-value"\}/,
  );
  assert.match(result.stdout, /- codex\.remove\.value\n {4}- true/);
  assert.doesNotMatch(result.stdout, /Agent skills/);
});

test("diff reports clean active configuration", (t) => {
  const fixture = createFixture(t);
  run(fixture, ["apply"]);

  const result = run(fixture, ["diff"]);

  assert.equal((result.stdout.match(/ {2}clean/g) ?? []).length, 2);
});

test("diff explains formatting-only configuration drift", (t) => {
  const fixture = createFixture(t);
  run(fixture, ["apply"]);
  const activeCodex = path.join(fixture.home, ".codex", "config.toml");
  fs.appendFileSync(activeCodex, "\n");

  const result = run(fixture, ["diff"]);

  assert.match(
    result.stdout,
    /Codex configuration\n {2}~ formatting only; no setting paths changed/,
  );
});

test("Git path arguments are resolved from the home worktree root", (t) => {
  const fixture = createFixture(t);
  const gitDir = path.join(fixture.root, "mirror.git");
  const nested = path.join(fixture.home, "Code", "project");
  fs.mkdirSync(nested, { recursive: true });
  fs.writeFileSync(path.join(fixture.home, "root.txt"), "tracked from home\n");
  const initialized = spawnSync("git", ["init", "--bare", gitDir], {
    encoding: "utf8",
  });
  assert.equal(initialized.status, 0, initialized.stderr);
  fixture.env.AI_CONFIG_GIT_DIR = gitDir;
  fixture.env.AI_CONFIG_WORK_TREE = fixture.home;

  run(fixture, ["git", "add", "root.txt"], { cwd: nested });

  const tracked = spawnSync(
    "git",
    [`--git-dir=${gitDir}`, "ls-files", "--error-unmatch", "root.txt"],
    { encoding: "utf8" },
  );
  assert.equal(tracked.status, 0, tracked.stderr);
});
