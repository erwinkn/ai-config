#!/usr/bin/env bun

import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type RegistryType = "npm" | "pypi" | "crates";
type SourceType = RegistryType | "repo";

interface PackageIndexEntry {
  name: string;
  version: string;
  registry: RegistryType;
  path: string;
  fetchedAt: string;
}

interface RepoIndexEntry {
  name: string;
  version: string;
  path: string;
  fetchedAt: string;
}

interface SourcesIndex {
  packages: PackageIndexEntry[];
  repos: RepoIndexEntry[];
  updatedAt: string | null;
}

interface Source {
  type: SourceType;
  name: string;
  version?: string;
  ref?: string;
  path: string;
  fetchedAt: string;
  repository: string | null;
}

interface ParsedArgs {
  positional: string[];
  flags: Record<string, string | boolean>;
}

interface RepoSpec {
  type: "repo";
  name: string;
  ref?: string;
  repoUrl: string;
}

interface PackageSpec {
  type: RegistryType;
  name: string;
  version?: string;
}

interface WalkEntry {
  relPath: string;
  absPath: string;
  entry: import("node:fs").Dirent;
  st: import("node:fs").Stats;
}

interface AstGrepRange {
  start: { line: number; column: number };
  end: { line: number; column: number };
}

interface AstGrepNode {
  text(): string;
  range(): AstGrepRange;
  getMatch(name: string): AstGrepNode | null;
  getMultipleMatches(name: string): AstGrepNode[];
}

interface AstGrepRoot {
  findAll(pattern: string): AstGrepNode[];
}

interface AstGrepParseResult {
  root(): AstGrepRoot;
}

interface AstGrepNapiModule {
  Lang: Record<string, unknown>;
  parse(lang: unknown, content: string): AstGrepParseResult;
}

interface AstGrepMatch {
  file: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  text: string;
  metavars: Record<string, string>;
}

const IGNORED_DIRS = new Set([".git", "node_modules"]);
const DEFAULT_MAX_RESULTS = 100;
const DEFAULT_AST_LIMIT = 1000;
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = dirname(SCRIPT_DIR);
const AST_GREP_PACKAGE = "@ast-grep/napi";
const AST_GREP_NODE_MODULE = join(SKILL_ROOT, "node_modules", "@ast-grep", "napi");
const GETSRC_DIR_ENV = "GETSRC_DIR";
const LEGACY_DIR_ENV = `OPEN${"SRC_DIR"}`;
const LEGACY_STORE_NAME = `open${"src"}`;
const GETSRC_STORE_NAME = "getsrc";
const BACKEND_CLI_PACKAGE = `${LEGACY_STORE_NAME}@0.6.0`;
const AST_EXT_LANG_KEYS: Record<string, string> = {
  ".js": "JavaScript",
  ".mjs": "JavaScript",
  ".cjs": "JavaScript",
  ".jsx": "JavaScript",
  ".ts": "TypeScript",
  ".tsx": "Tsx",
  ".html": "Html",
  ".css": "Css",
};
const AST_STR_LANG_KEYS: Record<string, string> = {
  javascript: "JavaScript",
  js: "JavaScript",
  typescript: "TypeScript",
  ts: "TypeScript",
  tsx: "Tsx",
  jsx: "JavaScript",
  html: "Html",
  css: "Css",
};

function usage(): void {
  console.error(`dep-source: fetch/query dependency source code without MCP

Usage:
  dep-source.ts list
  dep-source.ts has <name> [--version <version>]
  dep-source.ts get <name>
  dep-source.ts resolve <spec>
  dep-source.ts fetch <spec...> [--modify true|false]
  dep-source.ts remove <name...>
  dep-source.ts clean [--packages] [--repos] [--npm] [--pypi] [--crates]
  dep-source.ts files <source> [--glob <pattern>]
  dep-source.ts tree <source> [--depth <n>] [--pattern <glob>]
  dep-source.ts grep <pattern> [--sources <a,b>] [--include <glob>] [--max-results <n>]
  dep-source.ts ast-grep <source> <pattern> [--glob <glob>] [--lang <lang|a,b>] [--limit <n>]
  dep-source.ts read <source> <path>
  dep-source.ts read-many <source> <path...>

Repo specs:
  gh:owner/repo[@ref]
  github:owner/repo[@ref] (also accepted)
`);
}

function parseArgv(argv: string[]): ParsedArgs {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      positional.push(token);
      continue;
    }

    const trimmed = token.slice(2);
    if (trimmed.length === 0) continue;

    const eq = trimmed.indexOf("=");
    if (eq >= 0) {
      const key = trimmed.slice(0, eq);
      const value = trimmed.slice(eq + 1);
      flags[key] = value;
      continue;
    }

    const key = trimmed;
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      flags[key] = next;
      i += 1;
    } else {
      flags[key] = true;
    }
  }

  return { positional, flags };
}

function toInt(value: string | boolean | undefined, fallback: number): number {
  if (value === undefined || value === null || value === "") return fallback;
  const n = Number.parseInt(String(value), 10);
  return Number.isFinite(n) ? n : fallback;
}

function toBool(value: string | boolean | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  if (typeof value === "boolean") return value;
  const s = value.trim().toLowerCase();
  if (s === "true" || s === "1" || s === "yes" || s === "on") return true;
  if (s === "false" || s === "0" || s === "no" || s === "off") return false;
  return fallback;
}

function getPaths(): { getsrcDir: string; getsrcCwd: string } {
  const explicitGetsrcDir = process.env[GETSRC_DIR_ENV];
  if (explicitGetsrcDir) {
    return {
      getsrcDir: explicitGetsrcDir,
      getsrcCwd: dirname(explicitGetsrcDir),
    };
  }

  const legacyDir = process.env[LEGACY_DIR_ENV];
  if (legacyDir) {
    return {
      getsrcDir: legacyDir,
      getsrcCwd: dirname(legacyDir),
    };
  }

  const xdgData = process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share");
  const preferredDir = join(xdgData, GETSRC_STORE_NAME);
  const fallbackDir = join(xdgData, LEGACY_STORE_NAME);
  const preferredHasIndex = existsSync(join(preferredDir, "sources.json"));
  const fallbackHasIndex = existsSync(join(fallbackDir, "sources.json"));

  return {
    getsrcDir: preferredHasIndex || !fallbackHasIndex ? preferredDir : fallbackDir,
    getsrcCwd: xdgData,
  };
}

function normalizeSourcePath(pathValue: string): string {
  const prefixes = [`${GETSRC_STORE_NAME}/`, `${LEGACY_STORE_NAME}/`];
  for (const prefix of prefixes) {
    if (pathValue.startsWith(prefix)) {
      return pathValue.slice(prefix.length);
    }
  }
  return pathValue;
}

async function readSourcesIndex(getsrcDir: string): Promise<SourcesIndex> {
  const sourcesPath = join(getsrcDir, "sources.json");
  if (!existsSync(sourcesPath)) {
    return { packages: [], repos: [], updatedAt: null };
  }

  const raw = JSON.parse(await readFile(sourcesPath, "utf8")) as Partial<SourcesIndex>;
  return {
    packages: Array.isArray(raw.packages) ? raw.packages : [],
    repos: Array.isArray(raw.repos) ? raw.repos : [],
    updatedAt: raw.updatedAt ?? null,
  };
}

function toUnifiedSources(index: SourcesIndex): Source[] {
  const out: Source[] = [];

  for (const pkg of index.packages) {
    out.push({
      type: pkg.registry,
      name: pkg.name,
      version: pkg.version,
      path: normalizeSourcePath(pkg.path),
      fetchedAt: pkg.fetchedAt,
      repository: null,
    });
  }

  for (const repo of index.repos) {
    out.push({
      type: "repo",
      name: repo.name,
      ref: repo.version,
      path: normalizeSourcePath(repo.path),
      fetchedAt: repo.fetchedAt,
      repository: repo.name.startsWith("github.com/")
        ? `https://${repo.name}`
        : `https://github.com/${repo.name}`,
    });
  }

  return out;
}

function getSourceOrThrow(sources: Source[], name: string): Source {
  const found = sources.find((s) => s.name === name);
  if (!found) {
    throw new Error(`Source not found: ${name}`);
  }
  return found;
}

function resolveInRoot(root: string, relativePath: string): string {
  const absRoot = resolve(root);
  const absPath = resolve(absRoot, relativePath);

  if (absPath !== absRoot && !absPath.startsWith(`${absRoot}/`)) {
    throw new Error(`Path traversal not allowed: ${relativePath}`);
  }

  return absPath;
}

function escapeRegex(ch: string): string {
  return ch.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function globToRegex(glob: string): RegExp {
  if (!glob || glob === "**" || glob === "**/*") {
    return /^.+$/;
  }

  let i = 0;
  let out = "^";
  while (i < glob.length) {
    const ch = glob[i];

    if (ch === "*") {
      const next = glob[i + 1];
      if (next === "*") {
        out += ".*";
        i += 2;
      } else {
        out += "[^/]*";
        i += 1;
      }
      continue;
    }

    if (ch === "?") {
      out += "[^/]";
      i += 1;
      continue;
    }

    out += escapeRegex(ch);
    i += 1;
  }

  out += "$";
  return new RegExp(out);
}

function hasGlobChars(pathValue: string): boolean {
  return /[*?[\]{}]/.test(pathValue);
}

function normalizeRepoPrefix(spec: string): string {
  if (spec.startsWith("gh:")) {
    return `github:${spec.slice(3)}`;
  }
  return spec;
}

function parseSpec(spec: string): RepoSpec | PackageSpec {
  const trimmed = spec.trim();

  const registryPrefixes = ["npm:", "pypi:", "pip:", "crates:", "cargo:"];
  const hasRegistryPrefix = registryPrefixes.some((p) =>
    trimmed.toLowerCase().startsWith(p)
  );

  const repoLike =
    trimmed.startsWith("gh:") ||
    trimmed.startsWith("github:") ||
    trimmed.startsWith("https://github.com/") ||
    (!trimmed.startsWith("@") && /^[^/\s]+\/[^/\s@]+(?:@.+)?$/.test(trimmed) && !hasRegistryPrefix);

  if (repoLike) {
    const clean = trimmed
      .replace(/^gh:/, "")
      .replace(/^github:/, "")
      .replace(/^https?:\/\/github\.com\//, "");
    const at = clean.indexOf("@");
    const ownerRepo = at >= 0 ? clean.slice(0, at) : clean;
    const ref = at >= 0 ? clean.slice(at + 1) : undefined;

    return {
      type: "repo",
      name: `github.com/${ownerRepo}`,
      ref,
      repoUrl: `https://github.com/${ownerRepo}`,
    };
  }

  let registry: RegistryType = "npm";
  let rest = trimmed;

  const lower = trimmed.toLowerCase();
  if (lower.startsWith("npm:")) {
    registry = "npm";
    rest = trimmed.slice(4);
  } else if (lower.startsWith("pypi:")) {
    registry = "pypi";
    rest = trimmed.slice(5);
  } else if (lower.startsWith("pip:")) {
    registry = "pypi";
    rest = trimmed.slice(4);
  } else if (lower.startsWith("crates:")) {
    registry = "crates";
    rest = trimmed.slice(7);
  } else if (lower.startsWith("cargo:")) {
    registry = "crates";
    rest = trimmed.slice(6);
  }

  let name = rest;
  let version: string | undefined;

  if (registry === "npm") {
    if (rest.startsWith("@")) {
      const slashIdx = rest.indexOf("/");
      const atIdx = rest.lastIndexOf("@");
      if (atIdx > slashIdx) {
        name = rest.slice(0, atIdx);
        version = rest.slice(atIdx + 1);
      }
    } else {
      const atIdx = rest.lastIndexOf("@");
      if (atIdx > 0) {
        name = rest.slice(0, atIdx);
        version = rest.slice(atIdx + 1);
      }
    }
  } else {
    if (rest.includes("==")) {
      const [n, v] = rest.split("==", 2);
      name = n;
      version = v;
    } else if (rest.includes("@")) {
      const atIdx = rest.lastIndexOf("@");
      if (atIdx > 0) {
        name = rest.slice(0, atIdx);
        version = rest.slice(atIdx + 1);
      }
    }
  }

  return {
    type: registry,
    name,
    ...(version ? { version } : {}),
  };
}

function runCmd(command: string, args: string[], cwd: string): {
  status: number;
  stdout: string;
  stderr: string;
} {
  const result: SpawnSyncReturns<string> = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });

  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function runGetsrcBackend(args: string[], getsrcCwd: string): { stdout: string; stderr: string } {
  const result = runCmd("bunx", ["--silent", BACKEND_CLI_PACKAGE, ...args], getsrcCwd);
  if (result.status !== 0) {
    const detail = result.stderr || result.stdout || "getsrc backend failed";
    throw new Error(detail.trim());
  }
  return result;
}

function ensureAstGrepDependencyInstalled(): boolean {
  if (existsSync(AST_GREP_NODE_MODULE)) return false;

  const install = runCmd("npm", ["install", "--prefix", SKILL_ROOT, "--no-save", AST_GREP_PACKAGE], SKILL_ROOT);
  if (install.status !== 0) {
    const detail = install.stderr || install.stdout || "npm install failed";
    throw new Error(`Failed to auto-install ast-grep dependency: ${detail.trim()}`);
  }

  return true;
}

async function loadAstGrepNapi(): Promise<AstGrepNapiModule> {
  try {
    return (await import(AST_GREP_PACKAGE)) as AstGrepNapiModule;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to load ast-grep dependency: ${msg}`);
  }
}

function parseMetavars(pattern: string): string[] {
  const matches = pattern.match(/\$+[A-Z_][A-Z0-9_]*/g) ?? [];
  return [...new Set(matches.map((m) => m.replace(/^\$+/, "")))];
}

function extractMetavars(node: AstGrepNode, varNames: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of varNames) {
    const one = node.getMatch(name);
    if (one) {
      out[name] = one.text();
      continue;
    }
    const many = node.getMultipleMatches(name);
    if (many.length > 0) {
      out[name] = many.map((n) => n.text()).join(", ");
    }
  }
  return out;
}

async function walkFiles(
  sourceRoot: string,
  onFile: (relPath: string) => Promise<boolean>,
  currentRel = ""
): Promise<boolean> {
  const absDir = currentRel ? join(sourceRoot, currentRel) : sourceRoot;
  const entries = await readdir(absDir, { withFileTypes: true });

  for (const entry of entries) {
    if (shouldSkipName(entry.name)) continue;

    const relPath = currentRel ? `${currentRel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      const keepWalking = await walkFiles(sourceRoot, onFile, relPath);
      if (!keepWalking) return false;
      continue;
    }

    const keepWalking = await onFile(relPath);
    if (!keepWalking) return false;
  }

  return true;
}

async function runAstGrepSearch(params: {
  sourceRoot: string;
  pattern: string;
  glob: string;
  limit: number;
  lang: string[] | null;
}): Promise<AstGrepMatch[]> {
  const astGrep = await loadAstGrepNapi();
  const fileMatcher = globToRegex(params.glob);
  const selectedLangs = params.lang
    ? new Set(
        params.lang
          .map((name) => AST_STR_LANG_KEYS[name])
          .filter((name): name is string => Boolean(name))
      )
    : null;

  const metavars = parseMetavars(params.pattern);
  const matches: AstGrepMatch[] = [];

  await walkFiles(params.sourceRoot, async (relPath) => {
    if (matches.length >= params.limit) return false;
    if (!(params.glob === "**/*" || fileMatcher.test(relPath))) return true;

    const langKey = AST_EXT_LANG_KEYS[extname(relPath).toLowerCase()];
    if (!langKey) return true;
    if (selectedLangs && !selectedLangs.has(langKey)) return true;

    const astLang = astGrep.Lang[langKey];
    if (!astLang) return true;

    const absPath = resolve(params.sourceRoot, relPath);
    let content: string;
    try {
      content = await readFile(absPath, "utf8");
    } catch {
      return true;
    }

    try {
      const root = astGrep.parse(astLang, content).root();
      const nodes = root.findAll(params.pattern);
      for (const node of nodes) {
        if (matches.length >= params.limit) break;
        const range = node.range();
        matches.push({
          file: relPath,
          line: range.start.line + 1,
          column: range.start.column + 1,
          endLine: range.end.line + 1,
          endColumn: range.end.column + 1,
          text: node.text(),
          metavars: extractMetavars(node, metavars),
        });
      }
    } catch {
      // Ignore parse errors for unsupported files and continue scanning.
    }

    return matches.length < params.limit;
  });

  return matches;
}

function shouldSkipName(name: string): boolean {
  return name.startsWith(".") || IGNORED_DIRS.has(name);
}

async function walkAllEntries(
  sourceRoot: string,
  onEntry: (entry: WalkEntry) => Promise<void>,
  currentRel = ""
): Promise<void> {
  const absDir = currentRel ? join(sourceRoot, currentRel) : sourceRoot;
  const entries = await readdir(absDir, { withFileTypes: true });

  for (const entry of entries) {
    if (shouldSkipName(entry.name)) continue;

    const relPath = currentRel ? `${currentRel}/${entry.name}` : entry.name;
    const absPath = join(sourceRoot, relPath);
    const st = await stat(absPath);

    await onEntry({ relPath, absPath, entry, st });

    if (entry.isDirectory()) {
      await walkAllEntries(sourceRoot, onEntry, relPath);
    }
  }
}

async function main(): Promise<void> {
  const { positional, flags } = parseArgv(process.argv.slice(2));
  const cmd = positional[0];

  if (!cmd || cmd === "-h" || cmd === "--help" || cmd === "help") {
    usage();
    process.exit(1);
  }

  const { getsrcDir, getsrcCwd } = getPaths();
  process.env[LEGACY_DIR_ENV] = getsrcDir;
  await mkdir(getsrcCwd, { recursive: true });

  const readUnifiedSources = async (): Promise<{ index: SourcesIndex; sources: Source[] }> => {
    const index = await readSourcesIndex(getsrcDir);
    return {
      index,
      sources: toUnifiedSources(index),
    };
  };

  try {
    if (cmd === "list") {
      const { index, sources } = await readUnifiedSources();
      console.log(JSON.stringify({ getsrcDir, updatedAt: index.updatedAt, count: sources.length, sources }, null, 2));
      return;
    }

    if (cmd === "has") {
      const name = positional[1];
      if (!name) throw new Error("Usage: has <name> [--version <version>]");

      const { sources } = await readUnifiedSources();
      const version = typeof flags.version === "string" ? flags.version : undefined;
      const has = sources.some((s) => s.name === name && (!version || s.version === version || s.ref === version));

      console.log(JSON.stringify({ name, version: version ?? null, has }, null, 2));
      return;
    }

    if (cmd === "get") {
      const name = positional[1];
      if (!name) throw new Error("Usage: get <name>");

      const { sources } = await readUnifiedSources();
      const source = sources.find((s) => s.name === name) ?? null;
      console.log(JSON.stringify({ source }, null, 2));
      return;
    }

    if (cmd === "resolve") {
      const spec = positional[1];
      if (!spec) throw new Error("Usage: resolve <spec>");
      console.log(JSON.stringify(parseSpec(spec), null, 2));
      return;
    }

    if (cmd === "fetch") {
      const specs = positional.slice(1);
      if (specs.length === 0) throw new Error("Usage: fetch <spec...> [--modify true|false]");

      const modify = toBool(flags.modify, false);
      const normalizedSpecs = specs.map(normalizeRepoPrefix);
      const args = ["--modify", String(modify), ...normalizedSpecs];

      const before = (await readUnifiedSources()).sources;
      const result = runGetsrcBackend(args, getsrcCwd);
      const after = (await readUnifiedSources()).sources;

      const beforeSet = new Set(before.map((s) => `${s.type}:${s.name}:${s.version ?? s.ref ?? ""}`));
      const added = after.filter((s) => !beforeSet.has(`${s.type}:${s.name}:${s.version ?? s.ref ?? ""}`));

      console.log(JSON.stringify({
        ok: true,
        specs,
        normalizedSpecs,
        modify,
        added,
        stdout: result.stdout.trim(),
        stderr: result.stderr.trim(),
      }, null, 2));
      return;
    }

    if (cmd === "remove") {
      const names = positional.slice(1);
      if (names.length === 0) throw new Error("Usage: remove <name...>");

      const before = (await readUnifiedSources()).sources;
      const result = runGetsrcBackend(["remove", ...names], getsrcCwd);
      const after = (await readUnifiedSources()).sources;

      const afterNames = new Set(after.map((s) => s.name));
      const removed = before.map((s) => s.name).filter((name) => !afterNames.has(name));

      console.log(JSON.stringify({
        ok: true,
        requested: names,
        removed,
        stdout: result.stdout.trim(),
        stderr: result.stderr.trim(),
      }, null, 2));
      return;
    }

    if (cmd === "clean") {
      const before = (await readUnifiedSources()).sources;
      const cleanArgs = ["clean"];

      for (const key of ["packages", "repos", "npm", "pypi", "crates"]) {
        if (flags[key] === true || String(flags[key]).toLowerCase() === "true") {
          cleanArgs.push(`--${key}`);
        }
      }

      const result = runGetsrcBackend(cleanArgs, getsrcCwd);
      const after = (await readUnifiedSources()).sources;

      const afterSet = new Set(after.map((s) => `${s.type}:${s.name}`));
      const removed = before
        .filter((s) => !afterSet.has(`${s.type}:${s.name}`))
        .map((s) => s.name);

      console.log(JSON.stringify({
        ok: true,
        removed,
        stdout: result.stdout.trim(),
        stderr: result.stderr.trim(),
      }, null, 2));
      return;
    }

    if (cmd === "files") {
      const sourceName = positional[1];
      if (!sourceName) throw new Error("Usage: files <source> [--glob <pattern>]");

      const glob = String(flags.glob ?? "**/*");
      const matcher = globToRegex(glob);
      const { sources } = await readUnifiedSources();
      const source = getSourceOrThrow(sources, sourceName);
      const sourceRoot = resolveInRoot(getsrcDir, source.path);

      const entries: Array<{ path: string; size: number; isDirectory: boolean }> = [];
      await walkAllEntries(sourceRoot, async ({ relPath, entry, st }) => {
        if (glob === "**/*" || matcher.test(relPath) || (entry.isDirectory() && matcher.test(`${relPath}/`))) {
          entries.push({
            path: relPath,
            size: entry.isDirectory() ? 0 : st.size,
            isDirectory: entry.isDirectory(),
          });
        }
      });

      entries.sort((a, b) => a.path.localeCompare(b.path));
      console.log(JSON.stringify({ source: sourceName, glob, count: entries.length, entries }, null, 2));
      return;
    }

    if (cmd === "tree") {
      const sourceName = positional[1];
      if (!sourceName) throw new Error("Usage: tree <source> [--depth <n>] [--pattern <glob>]");

      const depth = Math.max(1, toInt(flags.depth, 3));
      const pattern = typeof flags.pattern === "string" ? flags.pattern : null;
      const matcher = pattern ? globToRegex(pattern) : null;

      const { sources } = await readUnifiedSources();
      const source = getSourceOrThrow(sources, sourceName);
      const sourceRoot = resolveInRoot(getsrcDir, source.path);

      async function buildNode(
        absDir: string,
        relDir: string,
        level: number
      ): Promise<{ name: string; type: "dir"; children: Array<any> } | null> {
        if (level > depth) return null;

        const children: Array<any> = [];
        const dirents = await readdir(absDir, { withFileTypes: true });

        for (const dirent of dirents) {
          if (shouldSkipName(dirent.name)) continue;

          const relPath = relDir ? `${relDir}/${dirent.name}` : dirent.name;
          const absPath = join(absDir, dirent.name);

          if (dirent.isDirectory()) {
            const child = await buildNode(absPath, relPath, level + 1);
            const dirMatches = !matcher || matcher.test(relPath) || matcher.test(`${relPath}/`);
            if (child && (dirMatches || (child.children && child.children.length > 0))) {
              children.push(child);
            }
            continue;
          }

          if (!matcher || matcher.test(relPath)) {
            children.push({ name: dirent.name, type: "file" });
          }
        }

        children.sort((a, b) => a.name.localeCompare(b.name));
        const nodeName = relDir ? relDir.split("/").at(-1) ?? relDir : sourceName;
        return { name: nodeName, type: "dir", children };
      }

      const tree = await buildNode(sourceRoot, "", 1);
      console.log(JSON.stringify({ source: sourceName, depth, pattern, tree }, null, 2));
      return;
    }

    if (cmd === "read") {
      const sourceName = positional[1];
      const filePath = positional[2];
      if (!sourceName || !filePath) throw new Error("Usage: read <source> <path>");

      const { sources } = await readUnifiedSources();
      const source = getSourceOrThrow(sources, sourceName);
      const sourceRoot = resolveInRoot(getsrcDir, source.path);
      const absFile = resolveInRoot(sourceRoot, filePath);
      const content = await readFile(absFile, "utf8");

      console.log(JSON.stringify({ source: sourceName, path: filePath, content }, null, 2));
      return;
    }

    if (cmd === "read-many") {
      const sourceName = positional[1];
      const requested = positional.slice(2);
      if (!sourceName || requested.length === 0) {
        throw new Error("Usage: read-many <source> <path...>");
      }

      const { sources } = await readUnifiedSources();
      const source = getSourceOrThrow(sources, sourceName);
      const sourceRoot = resolveInRoot(getsrcDir, source.path);

      const expanded: string[] = [];

      for (const p of requested) {
        if (!hasGlobChars(p)) {
          expanded.push(p);
          continue;
        }

        const rg = runCmd(
          "rg",
          ["--files", "--glob", p, "--glob", "!**/node_modules/**", "--glob", "!**/.git/**"],
          sourceRoot
        );

        if (rg.status === 0) {
          for (const line of rg.stdout.split("\n")) {
            const trimmed = line.trim();
            if (trimmed) expanded.push(trimmed);
          }
        }
      }

      const unique = [...new Set(expanded)];
      const result: Record<string, string> = {};

      for (const relPath of unique) {
        try {
          const absPath = resolveInRoot(sourceRoot, relPath);
          result[relPath] = await readFile(absPath, "utf8");
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result[relPath] = `[Error: ${msg}]`;
        }
      }

      console.log(JSON.stringify({ source: sourceName, files: result }, null, 2));
      return;
    }

    if (cmd === "grep") {
      const pattern = positional[1];
      if (!pattern) {
        throw new Error("Usage: grep <pattern> [--sources <a,b>] [--include <glob>] [--max-results <n>]");
      }

      const include = String(flags.include ?? "**/*");
      const maxResults = Math.max(1, toInt(flags["max-results"], DEFAULT_MAX_RESULTS));
      const selected = flags.sources
        ? new Set(String(flags.sources).split(",").map((s) => s.trim()).filter(Boolean))
        : null;

      const { sources } = await readUnifiedSources();
      const filteredSources = selected ? sources.filter((s) => selected.has(s.name)) : sources;

      const matches: Array<{ source: string; file: string; line: number; content: string }> = [];

      for (const source of filteredSources) {
        if (matches.length >= maxResults) break;

        const sourceRoot = resolveInRoot(getsrcDir, source.path);
        const rg = runCmd(
          "rg",
          [
            "--json",
            "--line-number",
            "--ignore-case",
            "--glob",
            include,
            "--glob",
            "!**/node_modules/**",
            "--glob",
            "!**/.git/**",
            pattern,
            ".",
          ],
          sourceRoot
        );

        if (rg.status !== 0 && rg.status !== 1) {
          throw new Error(rg.stderr || rg.stdout || `rg failed for ${source.name}`);
        }

        for (const line of rg.stdout.split("\n")) {
          if (!line.trim()) continue;

          let parsed: any;
          try {
            parsed = JSON.parse(line);
          } catch {
            continue;
          }

          if (parsed.type !== "match") continue;
          const data = parsed.data;
          matches.push({
            source: source.name,
            file: data.path.text,
            line: data.line_number,
            content: String(data.lines.text ?? "").trim().slice(0, 200),
          });

          if (matches.length >= maxResults) break;
        }
      }

      console.log(JSON.stringify({ pattern, include, count: matches.length, matches }, null, 2));
      return;
    }

    if (cmd === "ast-grep") {
      const sourceName = positional[1];
      const pattern = positional[2];
      if (!sourceName || !pattern) {
        throw new Error("Usage: ast-grep <source> <pattern> [--glob <glob>] [--lang <lang|a,b>] [--limit <n>]");
      }

      const installedNow = ensureAstGrepDependencyInstalled();
      if (installedNow) {
        const rerun = runCmd("bun", [fileURLToPath(import.meta.url), ...process.argv.slice(2)], process.cwd());
        if (rerun.stdout) process.stdout.write(rerun.stdout);
        if (rerun.stderr) process.stderr.write(rerun.stderr);
        if (rerun.status !== 0) {
          throw new Error(`Failed to restart after ast-grep install (exit ${rerun.status})`);
        }
        return;
      }

      const glob = String(flags.glob ?? "**/*");
      const limit = Math.max(1, toInt(flags.limit, DEFAULT_AST_LIMIT));

      const langFlag = flags.lang
        ? String(flags.lang)
            .split(",")
            .map((l) => l.trim().toLowerCase())
            .filter(Boolean)
        : null;

      const { sources } = await readUnifiedSources();
      const source = getSourceOrThrow(sources, sourceName);
      const sourceRoot = resolveInRoot(getsrcDir, source.path);

      const matches = await runAstGrepSearch({
        sourceRoot,
        pattern,
        glob,
        limit,
        lang: langFlag,
      });

      console.log(JSON.stringify({ source: sourceName, pattern, glob, count: matches.length, matches }, null, 2));
      return;
    }

    throw new Error(`Unknown command: ${cmd}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ error: message }, null, 2));
    process.exit(1);
  }
}

void main();
