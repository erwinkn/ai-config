"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const { parse } = require("smol-toml");

const source = path.resolve(__dirname, "../../..");

function write(root, relative, content, mode) {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, { mode });
}

function run(fixture, command, args = [], success = true) {
  const result = spawnSync(command, args, {
    cwd: fixture.repo, env: fixture.env, encoding: "utf8", timeout: 120000,
  });
  if (success) assert.equal(result.status, 0, result.stderr || result.stdout);
  return result;
}

function fixture(t, platform = os.type(), shell = "/bin/bash") {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-setup-test."));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const repo = path.join(root, "source checkout");
  const home = path.join(root, "home");
  const bin = path.join(root, "bin");
  fs.mkdirSync(home);
  fs.mkdirSync(bin);
  for (const file of [".config/ai/install-version", ".config/ai/bin/ai",
    ".config/ai/lib/install.js", ".config/ai/lib/bb.js", ".config/ai/bin/setup-macos", ".config/ai/bin/setup-unix",
    ".config/ai/package.json", ".config/ai/package-lock.json"]) {
    const target = path.join(repo, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(source, file), target);
  }
  write(repo, ".config/ai/shared/claude.json", '{"theme":"dark"}\n');
  write(repo, ".config/ai/shared/codex.toml", 'model = "shared"\n');
  write(repo, ".agents/skills/example/SKILL.md", "Shared skill\n");
  write(repo, ".gitignore", ".config/ai/node_modules/\n.config/ai/local/\n");
  // Only uname is simulated. Git, Bash, Node, npm, and file operations are real.
  write(bin, "uname", `#!/bin/sh\nprintf '%s\\n' '${platform}'\n`, 0o755);
  const env = { ...process.env };
  for (const name of Object.keys(env)) {
    if (name.startsWith("AI_CONFIG_") || name.startsWith("GIT_")) delete env[name];
  }
  Object.assign(env, {
    HOME: home, SHELL: shell, PATH: `${bin}:${process.env.PATH}`,
    GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: path.join(root, "gitconfig"),
    GIT_AUTHOR_NAME: "Setup test", GIT_AUTHOR_EMAIL: "test@example.invalid",
    GIT_COMMITTER_NAME: "Setup test", GIT_COMMITTER_EMAIL: "test@example.invalid",
    npm_config_cache: path.join(root, "npm-cache"),
    npm_config_userconfig: path.join(root, "npmrc"),
  });
  const f = { root, repo, home, bin, env };
  run(f, "git", ["init", "-b", "main"]);
  run(f, "git", ["add", "."]);
  run(f, "git", ["commit", "-m", "Setup fixture"]);
  return f;
}

function setup(f) { return run(f, path.join(f.repo, ".config/ai/bin/setup-unix")); }
function text(f, file) { return fs.readFileSync(path.join(f.home, file), "utf8"); }

for (const platform of ["Linux", "Darwin"]) {
  test(`${platform} setup preserves local settings, skills, backups, and reruns`, (t) => {
    const f = fixture(t, platform);
    write(f.home, ".claude/settings.json", '{"theme":"light","localOnly":true}\n');
    write(f.home, ".codex/config.toml", 'model = "device"\n');
    write(f.home, ".agents/skills/example/SKILL.md", "Local skill\n");
    write(f.home, ".agents/.skill-lock.json", '{"device":true}\n');
    setup(f);
    assert.equal(JSON.parse(text(f, ".claude/settings.json")).theme, "light");
    assert.equal(parse(text(f, ".codex/config.toml")).model, "device");
    assert.equal(text(f, ".agents/skills/example/SKILL.md"), "Shared skill\n");
    assert.equal(text(f, ".agents/.skill-lock.json"), '{"device":true}\n');
    assert.equal(JSON.parse(text(f, ".config/ai/shared/claude.json")).theme, "dark");
    assert.equal(JSON.parse(text(f, ".config/ai/local/claude.json")).theme, "light");
    assert.equal(fs.statSync(path.join(f.home, ".config/ai/local/claude.json")).mode & 0o777, 0o600);
    const backups = fs.readdirSync(path.join(f.home, ".local/state/ai/backups"));
    assert.equal(text(f, `.local/state/ai/backups/${backups[0]}/.claude/settings.json`), '{"theme":"light","localOnly":true}\n');
    assert.equal(text(f, `.local/state/ai/backups/${backups[0]}/.agents/skills/example/SKILL.md`), "Local skill\n");
    assert.equal(fs.readlinkSync(path.join(f.home, ".local/bin/ai")), path.join(f.home, ".config/ai/bin/ai"));
    write(f.home, ".agents/skills/example/SKILL.md", "Edited tracked skill\n");
    setup(f);
    run(f, path.join(f.home, ".local/bin/ai"), ["sync"]);
    assert.equal(parse(text(f, ".codex/config.toml")).model, "device");
    assert.equal(text(f, ".agents/skills/example/SKILL.md"), "Edited tracked skill\n");
    const profile = platform === "Linux" ? ".profile" : ".zprofile";
    assert.equal(text(f, profile).split("# Added by ai-config setup").length - 1, 1);
    assert.equal(run(f, "git", ["status", "--porcelain"]).stdout, "");
  });
}

for (const profile of [".profile", ".bash_profile", ".bash_login"]) {
  test(`Linux Bash uses ${profile} and interactive PATH without duplicates`, (t) => {
    const f = fixture(t, "Linux");
    write(f.home, profile, "printf 'Login startup message\\n'\n");
    write(f.home, ".bashrc", "printf 'Interactive startup message\\n'\n");
    setup(f);
    // Keep command results separate from host and user startup messages.
    run(f, "bash", ["--login", "-c", 'command -v ai > "$HOME/login-ai"']);
    assert.equal(text(f, "login-ai").trim(), path.join(f.home, ".local/bin/ai"));
    // Source twice to check the PATH guard as well as normal login above.
    run(f, "bash", ["--noprofile", "--norc", "-c",
      `. "$HOME/${profile}"; . "$HOME/${profile}"; command -v ai > "$HOME/repeated-ai"; printf '%s\\n' "$PATH" > "$HOME/repeated-path"`]);
    assert.equal(text(f, "repeated-ai").trim(), path.join(f.home, ".local/bin/ai"));
    assert.equal(text(f, "repeated-path").trim().split(":").filter(p => p === path.join(f.home, ".local/bin")).length, 1);
    run(f, "bash", ["--noprofile", "--rcfile", path.join(f.home, ".bashrc"), "-ic",
      'command -v ai > "$HOME/interactive-ai"']);
    assert.equal(text(f, "interactive-ai").trim(), path.join(f.home, ".local/bin/ai"));
  });
}

test("Linux zsh startup files and unknown shell guidance", (t) => {
  const f = fixture(t, "Linux", "/usr/bin/zsh");
  setup(f);
  assert.match(text(f, ".zprofile"), /Added by ai-config setup/);
  assert.match(text(f, ".zshrc"), /Added by ai-config setup/);
  f.env.SHELL = "/usr/bin/fish";
  assert.match(setup(f).stdout, /Add ~\/.local\/bin to PATH/);
  assert.equal(fs.existsSync(path.join(f.home, ".config/fish/config.fish")), false);
});

test("unsupported OS and macOS-only entry point fail before writes", (t) => {
  const f = fixture(t, "FreeBSD");
  const result = run(f, path.join(f.repo, ".config/ai/bin/setup-unix"), [], false);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /supported systems are macOS and Linux/);
  assert.deepEqual(fs.readdirSync(f.home), []);
  const legacy = run(f, path.join(f.repo, ".config/ai/bin/setup-macos"), [], false);
  assert.notEqual(legacy.status, 0);
  assert.match(legacy.stderr, /supports macOS only/);
});

test("Linux rejects old Node before config writes and never runs Homebrew", (t) => {
  const f = fixture(t, "Linux");
  write(f.bin, "node", "#!/bin/sh\necho 16\n", 0o755);
  write(f.bin, "brew", "#!/bin/sh\necho 'Homebrew must not run' >&2\nexit 99\n", 0o755);
  const result = run(f, path.join(f.repo, ".config/ai/bin/setup-unix"), [], false);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Node.js 18 or later and npm are required/);
  assert.doesNotMatch(result.stderr, /Homebrew must not run/);
  assert.deepEqual(fs.readdirSync(f.home), []);
});

function legacyFixture(t) {
  const f = fixture(t, "Linux");
  const current = run(f, "git", ["rev-parse", "HEAD"]).stdout.trim();
  fs.renameSync(path.join(f.repo, ".config/ai"), path.join(f.repo, ".config/ai-config"));
  fs.rmSync(path.join(f.repo, ".agents"), { recursive: true });
  write(f.repo, ".config/ai-config/shared/skills/agents/example/SKILL.md", "Shared skill\n");
  write(f.repo, ".gitignore", ".agents/skills/\n.claude/skills/\n.config/ai-config/local/\n.config/ai-config/node_modules/\n");
  run(f, "git", ["add", "-A"]);
  run(f, "git", ["commit", "-m", "Legacy installation"]);
  run(f, "git", ["clone", "--bare", f.repo, path.join(f.home, ".ai-config")]);
  run(f, "git", [`--git-dir=${f.home}/.ai-config`, `--work-tree=${f.home}`, "checkout"]);
  write(f.home, ".config/ai-config/local/claude.json", '{"theme":"dark","pinned":true}\n');
  write(f.home, ".config/ai-config/local/codex.toml", 'model = "device"\n');
  write(f.home, ".config/ai-config/local/bb.json", '{"settings":{"device":true}}\n');
  write(f.home, ".local/state/ai-config/last-rendered/claude.json", '{"theme":"dark","pinned":true}\n');
  write(f.home, ".local/state/ai-config/last-rendered/codex.toml", 'model = "device"\n');
  write(f.home, ".claude/settings.json", '{"theme":"dark","pinned":true,"directEdit":true}\n');
  write(f.home, ".codex/config.toml", 'model = "device"\n');
  write(f.home, ".agents/skills/example/SKILL.md", "Edited legacy skill\n");
  write(f.home, ".agents/skills/personal/SKILL.md", "Personal skill\n");
  fs.mkdirSync(path.join(f.home, ".local/bin"), { recursive: true });
  fs.symlinkSync(path.join(f.home, ".config/ai-config/bin/ai"), path.join(f.home, ".local/bin/ai"));
  run(f, "git", ["rm", "-r", ".config/ai-config"]);
  run(f, "git", ["checkout", current, "--", "."]);
  run(f, "git", ["commit", "-m", "Version 1 layout"]);
  return f;
}

function assertUpgrade(f) {
  assert.equal(text(f, ".local/state/ai-config/install-version"), "1\n");
  assert.deepEqual(JSON.parse(text(f, ".config/ai/local/claude.json")), { theme: "dark", pinned: true, directEdit: true });
  assert.equal(parse(text(f, ".config/ai/local/codex.toml")).model, "device");
  assert.equal(JSON.parse(text(f, ".config/ai/local/bb.json")).settings.device, true);
  assert.equal(text(f, ".agents/skills/example/SKILL.md"), "Edited legacy skill\n");
  assert.equal(text(f, ".agents/skills/personal/SKILL.md"), "Personal skill\n");
  assert.equal(text(f, ".local/state/ai-config/migration-0-to-1/backup/.agents/skills/example/SKILL.md"), "Edited legacy skill\n");
  assert.equal(fs.readlinkSync(path.join(f.home, ".local/bin/ai")), path.join(f.home, ".config/ai/bin/ai"));
  run(f, path.join(f.home, ".local/bin/ai"), ["status"]);
}

test("version 0 upgrade preserves pins, BB settings, direct edits, and skill edits", (t) => {
  const f = legacyFixture(t);
  setup(f);
  assertUpgrade(f);
  setup(f);
  assertUpgrade(f);
});

test("an interrupted upgrade resumes after checkout without losing local changes", (t) => {
  const f = legacyFixture(t);
  const npm = spawnSync("which", ["npm"], { encoding: "utf8" }).stdout.trim();
  write(f.bin, "npm", `#!/bin/sh\nif [ "$PWD" = "$HOME/.config/ai" ] && [ ! -f "$HOME/failed-once" ]; then\n touch "$HOME/failed-once"\n exit 42\nfi\nexec "${npm}" "$@"\n`, 0o755);
  const failed = run(f, path.join(f.repo, ".config/ai/bin/setup-unix"), [], false);
  assert.notEqual(failed.status, 0);
  assert.equal(fs.existsSync(path.join(f.home, ".local/state/ai-config/install-version")), false);
  assert.equal(text(f, ".agents/skills/example/SKILL.md"), "Edited legacy skill\n");
  setup(f);
  assertUpgrade(f);
});

test("conflicting local settings stop migration before checkout", (t) => {
  const f = legacyFixture(t);
  write(f.home, ".config/ai/local/claude.json", '{"theme":"other"}\n');
  const result = run(f, path.join(f.repo, ".config/ai/bin/setup-unix"), [], false);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Migration conflict/);
  assert.equal(text(f, ".agents/skills/example/SKILL.md"), "Edited legacy skill\n");
  assert.equal(fs.existsSync(path.join(f.home, ".local/state/ai-config/install-version")), false);
});

test("unknown installation versions stop before installation changes", (t) => {
  const f = fixture(t, "Linux");
  write(f.home, ".local/state/ai-config/install-version", "2\n");
  const result = run(f, path.join(f.repo, ".config/ai/bin/setup-unix"), [], false);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unsupported installation version/);
  assert.equal(fs.existsSync(path.join(f.home, ".ai-config")), false);
  assert.equal(text(f, ".local/state/ai-config/install-version"), "2\n");
});

test("migration preserves deletions and takes upstream changes for unmodified skills", (t) => {
  const f = legacyFixture(t);
  write(f.home, ".agents/skills/example/SKILL.md", "Shared skill\n");
  write(f.repo, ".agents/skills/example/SKILL.md", "New upstream skill\n");
  run(f, "git", ["add", ".agents/skills/example/SKILL.md"]);
  run(f, "git", ["commit", "-m", "Change shared skill"]);
  setup(f);
  assert.equal(text(f, ".agents/skills/example/SKILL.md"), "New upstream skill\n");
  const deleted = legacyFixture(t);
  fs.unlinkSync(path.join(deleted.home, ".agents/skills/example/SKILL.md"));
  setup(deleted);
  assert.equal(fs.existsSync(path.join(deleted.home, ".agents/skills/example/SKILL.md")), false);
});

test("divergent edits in the old skill scopes stop before removal", (t) => {
  const f = legacyFixture(t);
  write(f.home, ".claude/skills/example/SKILL.md", "Different Claude edit\n");
  const result = run(f, path.join(f.repo, ".config/ai/bin/setup-unix"), [], false);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Conflicting agent and Claude skill edits/);
  assert.equal(text(f, ".agents/skills/example/SKILL.md"), "Edited legacy skill\n");
  assert.equal(text(f, ".claude/skills/example/SKILL.md"), "Different Claude edit\n");
});

test("a live installation lock prevents concurrent setup", (t) => {
  const f = legacyFixture(t);
  write(f.home, ".local/state/ai-config/install.lock", String(process.pid));
  const result = run(f, path.join(f.repo, ".config/ai/bin/setup-unix"), [], false);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Another setup process/);
  assert.equal(text(f, ".agents/skills/example/SKILL.md"), "Edited legacy skill\n");
});

test("the CLI rejects a pending upgrade before capture or sync", (t) => {
  const f = legacyFixture(t);
  const before = text(f, ".claude/settings.json");
  const result = run(f, "node", [path.join(f.repo, ".config/ai/bin/ai"), "capture"], false);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Installation upgrade required/);
  assert.equal(text(f, ".claude/settings.json"), before);
});

test("sync stops before checkout when upstream requires a future installation version", (t) => {
  const f = fixture(t, "Linux");
  setup(f);
  const gitArgs = [`--git-dir=${f.home}/.ai-config`, `--work-tree=${f.home}`];
  const before = run(f, "git", [...gitArgs, "rev-parse", "HEAD"]).stdout;
  write(f.repo, ".config/ai/install-version", "2\n");
  run(f, "git", ["add", ".config/ai/install-version"]);
  run(f, "git", ["commit", "-m", "Future installation layout"]);
  const result = run(f, path.join(f.home, ".local/bin/ai"), ["sync"], false);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /incoming installation layout requires setup/);
  assert.equal(run(f, "git", [...gitArgs, "rev-parse", "HEAD"]).stdout, before);
  assert.equal(text(f, ".local/state/ai-config/install-version"), "1\n");
});

test("setup rejects a future upstream layout before removing legacy skills", (t) => {
  const f = legacyFixture(t);
  write(f.repo, ".config/ai/install-version", "2\n");
  run(f, "git", ["add", ".config/ai/install-version"]);
  run(f, "git", ["commit", "-m", "Future layout"]);
  const result = run(f, path.join(f.repo, ".config/ai/bin/setup-unix"), [], false);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /different setup release/);
  assert.equal(text(f, ".agents/skills/example/SKILL.md"), "Edited legacy skill\n");
  assert.equal(fs.existsSync(path.join(f.home, ".local/state/ai-config/install-version")), false);
});

test("rendered Claude copies of aliased packages do not replace edited agent skills", (t) => {
  const f = legacyFixture(t);
  const oldShared = path.join(f.home, ".config/ai-config/shared/skills/claude");
  fs.mkdirSync(oldShared, { recursive: true });
  fs.symlinkSync("../agents/example", path.join(oldShared, "example"));
  write(f.home, ".claude/skills/example/SKILL.md", "Shared skill\n");
  setup(f);
  assert.equal(text(f, ".agents/skills/example/SKILL.md"), "Edited legacy skill\n");
});
