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
