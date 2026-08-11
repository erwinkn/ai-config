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

function writeSkill(root, target, name, content) {
  const directory = path.join(root, "shared", "skills", target, name);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "SKILL.md"), content);
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
  run(fixture, [
    "pin",
    "codex",
    "agents",
    "count",
    "--json-value",
    "20",
  ]);

  assert.equal(readJson(path.join(fixture.config, "local", "claude.json")).theme, "dark");
  assert.equal(readToml(path.join(fixture.config, "local", "codex.toml")).agents.count, 20);
});

test("an explicitly pinned object replaces the shared object", (t) => {
  const fixture = createFixture(t);
  run(fixture, ["apply"]);
  run(fixture, [
    "pin",
    "claude",
    "plugins",
    "--json-value",
    '{"one":false}',
  ]);

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

test("a direct skill edit becomes a local package override", (t) => {
  const fixture = createFixture(t);
  writeSkill(fixture.config, "agents", "example", "shared\n");
  run(fixture, ["apply"]);
  const active = path.join(fixture.home, ".agents", "skills", "example", "SKILL.md");
  fs.writeFileSync(active, "local\n");

  run(fixture, ["capture"]);

  assert.equal(
    fs.readFileSync(
      path.join(fixture.config, "local", "skills", "agents", "example", "SKILL.md"),
      "utf8",
    ),
    "local\n",
  );
  assert.equal(
    fs.readFileSync(
      path.join(fixture.config, "shared", "skills", "agents", "example", "SKILL.md"),
      "utf8",
    ),
    "shared\n",
  );
});

test("first skill capture keeps new packages local without deleting shared packages", (t) => {
  const fixture = createFixture(t);
  writeSkill(fixture.config, "agents", "shared-skill", "shared\n");
  const activeLocal = path.join(
    fixture.home,
    ".agents",
    "skills",
    "local-skill",
  );
  fs.mkdirSync(activeLocal, { recursive: true });
  fs.writeFileSync(path.join(activeLocal, "SKILL.md"), "local\n");

  run(fixture, ["capture"]);

  assert.equal(
    fs.readFileSync(
      path.join(fixture.config, "local", "skills", "agents", "local-skill", "SKILL.md"),
      "utf8",
    ),
    "local\n",
  );
  assert.equal(
    fs.readFileSync(
      path.join(fixture.home, ".agents", "skills", "shared-skill", "SKILL.md"),
      "utf8",
    ),
    "shared\n",
  );
  assert.equal(
    fs.existsSync(
      path.join(fixture.config, "local", "skills", "agents", ".deletions.json"),
    ),
    false,
  );
});

test("a deleted active skill gets a local deletion marker", (t) => {
  const fixture = createFixture(t);
  writeSkill(fixture.config, "agents", "example", "shared\n");
  run(fixture, ["apply"]);
  fs.rmSync(path.join(fixture.home, ".agents", "skills", "example"), {
    recursive: true,
  });

  run(fixture, ["capture"]);

  assert.deepEqual(
    readJson(
      path.join(fixture.config, "local", "skills", "agents", ".deletions.json"),
    ),
    ["example"],
  );
  assert.equal(
    fs.existsSync(path.join(fixture.home, ".agents", "skills", "example")),
    false,
  );

  run(fixture, ["skills", "reset", "agents", "example"]);
  assert.equal(
    fs.readFileSync(
      path.join(fixture.home, ".agents", "skills", "example", "SKILL.md"),
      "utf8",
    ),
    "shared\n",
  );
});

test("apply refuses to overwrite an uncaptured skill change", (t) => {
  const fixture = createFixture(t);
  writeSkill(fixture.config, "claude", "example", "shared\n");
  run(fixture, ["apply"]);
  const active = path.join(fixture.home, ".claude", "skills", "example", "SKILL.md");
  fs.writeFileSync(active, "changed\n");

  const result = runFailure(fixture, ["apply"]);

  assert.match(result.stderr, /Skills changed after the last render/);
  assert.equal(fs.readFileSync(active, "utf8"), "changed\n");
});

test("generated Python cache files do not create skill drift", (t) => {
  const fixture = createFixture(t);
  writeSkill(fixture.config, "agents", "example", "shared\n");
  run(fixture, ["apply"]);
  const cache = path.join(
    fixture.home,
    ".agents",
    "skills",
    "example",
    "__pycache__",
  );
  fs.mkdirSync(cache);
  fs.writeFileSync(path.join(cache, "generated.pyc"), "generated");

  run(fixture, ["apply"]);

  assert.equal(fs.existsSync(cache), false);
  assert.equal(
    fs.existsSync(path.join(fixture.config, "local", "skills", "agents", "example")),
    false,
  );
});

test("agent and Claude skill packages are independent", (t) => {
  const fixture = createFixture(t);
  writeSkill(fixture.config, "agents", "example", "agent version\n");
  writeSkill(fixture.config, "claude", "example", "Claude version\n");
  run(fixture, ["apply"]);
  const claudeActive = path.join(
    fixture.home,
    ".claude",
    "skills",
    "example",
    "SKILL.md",
  );
  fs.writeFileSync(claudeActive, "local Claude version\n");

  run(fixture, ["capture"]);

  assert.equal(
    fs.existsSync(
      path.join(fixture.config, "local", "skills", "agents", "example"),
    ),
    false,
  );
  assert.equal(
    fs.readFileSync(
      path.join(fixture.config, "local", "skills", "claude", "example", "SKILL.md"),
      "utf8",
    ),
    "local Claude version\n",
  );
});

test("a shared target alias renders as an independent active package", (t) => {
  const fixture = createFixture(t);
  writeSkill(fixture.config, "agents", "example", "shared package\n");
  const claudeRoot = path.join(fixture.config, "shared", "skills", "claude");
  fs.mkdirSync(claudeRoot, { recursive: true });
  fs.symlinkSync("../agents/example", path.join(claudeRoot, "example"));

  run(fixture, ["apply"]);

  const active = path.join(fixture.home, ".claude", "skills", "example");
  assert.equal(fs.lstatSync(active).isDirectory(), true);
  assert.equal(fs.readFileSync(path.join(active, "SKILL.md"), "utf8"), "shared package\n");
});

test("rendering preserves relative links inside a skill package", (t) => {
  const fixture = createFixture(t);
  const shared = path.join(
    fixture.config,
    "shared",
    "skills",
    "agents",
    "example",
  );
  fs.mkdirSync(shared, { recursive: true });
  fs.writeFileSync(path.join(shared, "AGENTS.md"), "instructions\n");
  fs.symlinkSync("AGENTS.md", path.join(shared, "CLAUDE.md"));

  run(fixture, ["apply"]);

  const activeLink = path.join(
    fixture.home,
    ".agents",
    "skills",
    "example",
    "CLAUDE.md",
  );
  assert.equal(fs.readlinkSync(activeLink), "AGENTS.md");

  run(fixture, ["capture"]);
  assert.equal(
    fs.existsSync(
      path.join(fixture.config, "local", "skills", "agents", "example"),
    ),
    false,
  );
});

test("sharing one target detaches a shared alias in the other target", (t) => {
  const fixture = createFixture(t);
  writeSkill(fixture.config, "agents", "example", "original\n");
  const claudeRoot = path.join(fixture.config, "shared", "skills", "claude");
  fs.mkdirSync(claudeRoot, { recursive: true });
  fs.symlinkSync("../agents/example", path.join(claudeRoot, "example"));
  run(fixture, ["apply"]);
  const active = path.join(fixture.home, ".agents", "skills", "example", "SKILL.md");
  fs.writeFileSync(active, "agent update\n");
  run(fixture, ["capture"]);

  run(fixture, ["skills", "share", "agents", "example"]);

  assert.equal(
    fs.readFileSync(
      path.join(fixture.config, "shared", "skills", "agents", "example", "SKILL.md"),
      "utf8",
    ),
    "agent update\n",
  );
  const claudeShared = path.join(
    fixture.config,
    "shared",
    "skills",
    "claude",
    "example",
  );
  assert.equal(fs.lstatSync(claudeShared).isDirectory(), true);
  assert.equal(fs.readFileSync(path.join(claudeShared, "SKILL.md"), "utf8"), "original\n");
});

test("pinning a shared skill creates an explicit local package", (t) => {
  const fixture = createFixture(t);
  writeSkill(fixture.config, "agents", "example", "version one\n");
  run(fixture, ["apply"]);
  run(fixture, ["skills", "pin", "agents", "example"]);
  writeSkill(fixture.config, "agents", "example", "version two\n");

  run(fixture, ["apply"]);

  assert.equal(
    fs.readFileSync(
      path.join(fixture.home, ".agents", "skills", "example", "SKILL.md"),
      "utf8",
    ),
    "version one\n",
  );
});

test("sharing a local skill promotes the full package", (t) => {
  const fixture = createFixture(t);
  writeSkill(fixture.config, "agents", "example", "shared\n");
  run(fixture, ["apply"]);
  const active = path.join(fixture.home, ".agents", "skills", "example", "SKILL.md");
  fs.writeFileSync(active, "promoted\n");
  run(fixture, ["capture"]);

  run(fixture, ["skills", "share", "agents", "example"]);

  assert.equal(
    fs.readFileSync(
      path.join(fixture.config, "shared", "skills", "agents", "example", "SKILL.md"),
      "utf8",
    ),
    "promoted\n",
  );
  assert.equal(
    fs.existsSync(path.join(fixture.config, "local", "skills", "agents", "example")),
    false,
  );
});

test("sharing identical local packages across targets creates a shared alias", (t) => {
  const fixture = createFixture(t);
  for (const target of ["agents", "claude"]) {
    const active = path.join(fixture.home, `.${target}`, "skills", "example");
    fs.mkdirSync(active, { recursive: true });
    fs.writeFileSync(path.join(active, "SKILL.md"), "same package\n");
  }
  run(fixture, ["capture"]);

  run(fixture, ["skills", "share", "agents", "example"]);
  run(fixture, ["skills", "share", "claude", "example"]);

  const agentsShared = path.join(
    fixture.config,
    "shared",
    "skills",
    "agents",
    "example",
  );
  const claudeShared = path.join(
    fixture.config,
    "shared",
    "skills",
    "claude",
    "example",
  );
  assert.equal(fs.lstatSync(claudeShared).isSymbolicLink(), true);
  assert.equal(fs.realpathSync(claudeShared), fs.realpathSync(agentsShared));
  assert.equal(
    fs.readFileSync(path.join(claudeShared, "SKILL.md"), "utf8"),
    "same package\n",
  );
});

test("sharing a local skill deletion removes the shared package", (t) => {
  const fixture = createFixture(t);
  writeSkill(fixture.config, "claude", "example", "shared\n");
  run(fixture, ["apply"]);
  run(fixture, ["skills", "remove", "claude", "example"]);

  run(fixture, ["skills", "share", "claude", "example"]);

  assert.equal(
    fs.existsSync(path.join(fixture.config, "shared", "skills", "claude", "example")),
    false,
  );
  assert.equal(
    fs.existsSync(
      path.join(fixture.config, "local", "skills", "claude", ".deletions.json"),
    ),
    false,
  );
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
