"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const VERSION = 1;
const home = process.env.AI_CONFIG_WORK_TREE || os.homedir();
const state = path.join(home, ".local/state/ai-config");
const marker = path.join(state, "install-version");
const journal = path.join(state, "migration-0-to-1");
const exists = (p) => !!stat(p);
function stat(p) {
  try { return fs.lstatSync(p); } catch (e) { if (e.code !== "ENOENT") throw e; }
}
function copy(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
  fs.cpSync(source, target, { recursive: true, verbatimSymlinks: true });
}
function atomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file + ".tmp", value, { mode: 0o600 });
  fs.renameSync(file + ".tmp", file);
}
function version() {
  if (!exists(marker)) return 0;
  const value = fs.readFileSync(marker, "utf8").trim();
  if (!/^[0-9]+$/.test(value) || Number(value) > VERSION) {
    throw new Error("Unsupported installation version. Use a matching setup release.");
  }
  return Number(value);
}
function entries(root, prefix = "", result = new Map()) {
  if (!exists(root)) return result;
  for (const name of fs.readdirSync(root)) {
    const rel = path.posix.join(prefix, name);
    const file = path.join(root, name);
    if (stat(file).isDirectory()) entries(file, rel, result);
    else result.set(rel, file);
  }
  return result;
}
function equal(a, b) {
  if (!a || !b) return a === b;
  const sa = stat(a), sb = stat(b);
  if (sa.isSymbolicLink() || sb.isSymbolicLink()) {
    return sa.isSymbolicLink() && sb.isSymbolicLink() && fs.readlinkSync(a) === fs.readlinkSync(b);
  }
  return fs.readFileSync(a).equals(fs.readFileSync(b));
}
function mergeCopy(source, target) {
  for (const [rel, file] of entries(source)) {
    const dest = path.join(target, rel);
    if (exists(dest) && !equal(file, dest)) {
      throw new Error(`Migration conflict at ${dest}. Keep one version before retrying.`);
    }
  }
  if (exists(source)) copy(source, target);
}
function packages(root) {
  const result = new Map();
  if (!exists(root)) return result;
  for (const name of fs.readdirSync(root)) {
    const file = fs.realpathSync(path.join(root, name));
    if (fs.statSync(file).isDirectory()) result.set(name, file);
  }
  return result;
}
function samePackage(a, b) {
  if (!a || !b) return a === b;
  const left = entries(a), right = entries(b);
  return left.size === right.size && [...left].every(([rel, file]) => equal(file, right.get(rel)));
}
function prepare() {
  if (version() === VERSION) return;
  if (exists(path.join(journal, "plan.json"))) return;
  const legacy = path.join(home, ".config/ai-config");
  const plan = {
    legacy: exists(path.join(legacy, "shared")) || exists(path.join(legacy, "local")) ||
      exists(path.join(state, "last-rendered")),
    skills: [],
  };
  const changes = new Map();
  if (plan.legacy) {
    // Two old scopes become one tracked tree. Never choose between divergent edits.
    for (const scope of ["agents", "claude"]) {
      const active = path.join(home, `.${scope}/skills`);
      if (stat(active)?.isSymbolicLink()) {
        if (scope === "claude" && fs.realpathSync(active) === path.join(home, ".agents/skills")) continue;
        throw new Error(`Resolve the custom skill directory link before upgrading: ${active}`);
      }
      // Local skills were complete package replacements, not file overlays.
      const baseline = packages(path.join(legacy, "shared/skills", scope));
      const current = packages(active);
      const localRoot = path.join(legacy, "local/skills", scope);
      const pinned = packages(localRoot);
      const deletedFile = path.join(localRoot, ".deletions.json");
      const deleted = exists(deletedFile) ? JSON.parse(fs.readFileSync(deletedFile, "utf8")) : [];
      if (!Array.isArray(deleted) || deleted.some(name => typeof name !== "string" ||
          !name || name === "." || name === ".." || /[\\/]/.test(name))) {
        throw new Error("Invalid legacy skill deletion list.");
      }
      for (const name of new Set([...baseline.keys(), ...current.keys(), ...pinned.keys(), ...deleted])) {
        const file = current.get(name);
        const alias = path.join(active, name);
        if (scope === "claude" && stat(alias)?.isSymbolicLink() &&
            file?.startsWith(path.join(home, ".agents/skills") + path.sep)) continue;
        if (!pinned.has(name) && !deleted.includes(name) && samePackage(file, baseline.get(name))) continue;
        if (changes.has(name) && !samePackage(changes.get(name), file)) {
          throw new Error(`Conflicting agent and Claude skill edits: ${name}`);
        }
        changes.set(name, file);
      }
    }

    // Preflight all settings before changing any installation files.
    for (const [rel, file] of entries(path.join(legacy, "local"))) {
      const dest = path.join(home, ".config/ai/local", rel);
      if (exists(dest) && !equal(file, dest)) throw new Error(`Migration conflict at ${dest}`);
    }
    for (const rel of [".config/ai-config/local", ".local/state/ai-config/last-rendered",
      ".local/state/ai-config/render-state.json", ".agents/skills", ".claude/skills",
      ".agents/.skill-lock.json", ".claude/settings.json", ".codex/config.toml", ".local/bin/ai"]) {
      const source = path.join(home, rel);
      if (exists(source)) copy(source, path.join(journal, "backup", rel));
    }
    for (const [rel, file] of changes) {
      if (file) copy(file, path.join(journal, "skills", rel));
      plan.skills.push({ rel, deleted: !file });
    }
  }
  atomic(path.join(journal, "plan.json"), JSON.stringify(plan));
}
function beforeCheckout() {
  if (version() === VERSION) return;
  const plan = JSON.parse(fs.readFileSync(path.join(journal, "plan.json")));
  if (!plan.legacy || exists(path.join(journal, "restored"))) return;
  if (!exists(path.join(journal, "relocated"))) {
    mergeCopy(path.join(journal, "backup/.config/ai-config/local"), path.join(home, ".config/ai/local"));
    mergeCopy(path.join(journal, "backup/.local/state/ai-config/last-rendered"), path.join(home, ".local/state/ai/last-rendered"));
    const oldState = path.join(journal, "backup/.local/state/ai-config/render-state.json");
    const newState = path.join(home, ".local/state/ai/render-state.json");
    if (exists(oldState) && !exists(newState)) copy(oldState, newState);
    atomic(path.join(journal, "relocated"), "1\n");
  }
  if (exists(path.join(home, ".config/ai/bin/ai"))) return;
  // The old ignored trees obstruct checkout of the new tracked files and symlink.
  for (const rel of [".agents/skills", ".claude/skills"]) {
    fs.rmSync(path.join(home, rel), { recursive: true, force: true });
  }
}
function restore() {
  if (version() === VERSION || exists(path.join(journal, "restored"))) return;
  const plan = JSON.parse(fs.readFileSync(path.join(journal, "plan.json")));
  for (const { rel, deleted } of plan.skills) {
    const dest = path.join(home, ".agents/skills", rel);
    fs.rmSync(dest, { recursive: true, force: true });
    if (!deleted) copy(path.join(journal, "skills", rel), dest);
  }
  atomic(path.join(journal, "restored"), "1\n");
}
function complete() {
  if (version() === VERSION) return;
  if (!exists(path.join(journal, "restored")) || !exists(path.join(home, ".config/ai/bin/ai")) ||
      !exists(path.join(home, ".config/ai/node_modules/smol-toml/package.json"))) {
    throw new Error("Installation is incomplete; rerun setup.");
  }
  if (process.platform !== "win32" && fs.realpathSync(path.join(home, ".local/bin/ai")) !==
      fs.realpathSync(path.join(home, ".config/ai/bin/ai"))) {
    throw new Error("The installed ai command does not point to the new CLI.");
  }
  if (fs.readFileSync(path.join(home, ".config/ai/install-version"), "utf8").trim() !== String(VERSION)) {
    throw new Error("The checkout requires a different setup release.");
  }
  atomic(marker, `${VERSION}\n`);
}
function check() {
  const v = version();
  if (v === 0 && (exists(path.join(home, ".config/ai-config/local")) || exists(path.join(home, ".config/ai-config/shared")) || exists(journal))) {
    throw new Error("Installation upgrade required. Run .config/ai/bin/setup-unix from an updated source checkout before using ai.");
  }
}
function acquire() {
  version();
  if (fs.readFileSync(path.join(__dirname, "../install-version"), "utf8").trim() !== String(VERSION)) {
    throw new Error("The source layout requires a different setup release.");
  }
  fs.mkdirSync(state, { recursive: true, mode: 0o700 });
  const lock = path.join(state, "install.lock");
  // All contenders serialize stale-owner inspection and replacement under this
  // short-lived atomic guard. Never automatically steal the recovery guard.
  const guard = path.join(state, "install-acquire");
  try { fs.mkdirSync(guard, { mode: 0o700 }); }
  catch (e) {
    if (e.code !== "EEXIST") throw e;
    throw new Error("Another setup process is acquiring the installation lock. Retry later; see the upgrade guide if install-acquire remains after a crash.");
  }
  try {
    try {
      const owner = Number(fs.readFileSync(lock, "utf8"));
      if (!Number.isInteger(owner) || owner <= 0) throw new Error("Invalid installation lock; inspect install.lock.");
      try { process.kill(owner, 0); throw new Error("Another setup process is running."); }
      catch (e) { if (e.code !== "ESRCH") throw e; }
      fs.unlinkSync(lock);
    } catch (e) { if (e.code !== "ENOENT") throw e; }
    fs.writeFileSync(lock, String(process.ppid), { flag: "wx", mode: 0o600 });
  } finally { fs.rmdirSync(guard); }
}
function release() {
  const lock = path.join(state, "install.lock");
  if (exists(lock) && fs.readFileSync(lock, "utf8") === String(process.ppid)) fs.unlinkSync(lock);
}
module.exports = { VERSION, version, check };
if (require.main === module) {
  try {
    const actions = { acquire, release, prepare, beforeCheckout, restore, complete, check: version };
    const action = actions[process.argv[2]];
    if (!action) throw new Error("Unknown installation action");
    action();
  } catch (e) { console.error(`setup: ${e.message}`); process.exitCode = 1; }
}
