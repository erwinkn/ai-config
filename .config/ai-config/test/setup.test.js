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
  for (const file of ["setup", "Makefile", ".config/ai-config/bin/ai",
    ".config/ai-config/bin/setup-macos", ".config/ai-config/bin/setup-unix",
    ".config/ai-config/package.json", ".config/ai-config/package-lock.json"]) {
    const target = path.join(repo, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(source, file), target);
  }
  write(repo, ".config/ai-config/shared/claude.json", '{"theme":"dark"}\n');
  write(repo, ".config/ai-config/shared/codex.toml", 'model = "shared"\n');
  write(repo, ".config/ai-config/shared/skills/agents/example/SKILL.md", "Shared skill\n");
  write(repo, ".gitignore", ".config/ai-config/node_modules/\n.config/ai-config/local/\n");
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

function setup(f) { return run(f, path.join(f.repo, "setup")); }
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
    assert.equal(text(f, ".agents/skills/example/SKILL.md"), "Local skill\n");
    assert.equal(text(f, ".agents/.skill-lock.json"), '{"device":true}\n');
    assert.equal(JSON.parse(text(f, ".config/ai-config/shared/claude.json")).theme, "dark");
    assert.equal(JSON.parse(text(f, ".config/ai-config/local/claude.json")).theme, "light");
    assert.equal(fs.statSync(path.join(f.home, ".config/ai-config/local/claude.json")).mode & 0o777, 0o600);
    const backups = fs.readdirSync(path.join(f.home, ".local/state/ai-config/backups"));
    assert.equal(text(f, `.local/state/ai-config/backups/${backups[0]}/.claude/settings.json`), '{"theme":"light","localOnly":true}\n');
    assert.equal(fs.readlinkSync(path.join(f.home, ".local/bin/ai")), path.join(f.home, ".config/ai-config/bin/ai"));
    setup(f);
    run(f, path.join(f.home, ".local/bin/ai"), ["sync"]);
    assert.equal(parse(text(f, ".codex/config.toml")).model, "device");
    assert.equal(text(f, ".agents/skills/example/SKILL.md"), "Local skill\n");
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
  const result = run(f, path.join(f.repo, "setup"), [], false);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /supported systems are macOS and Linux/);
  assert.deepEqual(fs.readdirSync(f.home), []);
  const legacy = run(f, path.join(f.repo, ".config/ai-config/bin/setup-macos"), [], false);
  assert.notEqual(legacy.status, 0);
  assert.match(legacy.stderr, /supports macOS only/);
});

test("Linux rejects old Node before config writes and never runs Homebrew", (t) => {
  const f = fixture(t, "Linux");
  write(f.bin, "node", "#!/bin/sh\necho 16\n", 0o755);
  write(f.bin, "brew", "#!/bin/sh\necho 'Homebrew must not run' >&2\nexit 99\n", 0o755);
  const result = run(f, path.join(f.repo, "setup"), [], false);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Node.js 18 or later and npm are required/);
  assert.doesNotMatch(result.stderr, /Homebrew must not run/);
  assert.deepEqual(fs.readdirSync(f.home), []);
});


test("Makefile sync-home uses the installed ai without a shell profile", (t) => {
  const f = fixture(t, "Linux");
  write(f.home, ".local/bin/ai", `#!/bin/sh\nprintf '%s\\n' "$*" > "$HOME/ai-call"\n`, 0o755);
  run(f, "make", ["sync-home"]);
  assert.equal(text(f, "ai-call"), "sync\n");
  fs.unlinkSync(path.join(f.home, "ai-call"));
  const publish = run(f, "make", ["-n", "publish", "MSG=Test commit"]);
  assert.match(publish.stdout, /git add -A/);
  assert.match(publish.stdout, /git commit -m "Test commit"/);
  assert.match(publish.stdout, /git push/);
  assert.match(publish.stdout, /"\$HOME\/\.local\/bin\/ai" sync/);
  assert.doesNotMatch(publish.stdout, /zsh/);
  assert.equal(fs.existsSync(path.join(f.home, "ai-call")), false);
});
