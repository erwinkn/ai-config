#!/usr/bin/env bun

import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { createInterface } from "node:readline";

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

interface SourceView extends Source {
  id: string;
  label: string;
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

interface TreeNode {
  name: string;
  type: "dir" | "file";
  children?: TreeNode[];
}

interface ReadSlice {
  start: number;
  end: number;
  total: number;
  lines: string[];
}

interface RenderOptions {
  fields: string[] | null;
  maxItems: number | null;
  maxChars: number | null;
  maxCharsProvided: boolean;
  noMeta: boolean;
  noNull: boolean;
  logs: boolean;
  long: boolean;
}

interface CommandContext {
  getsrcDir: string;
  getsrcCwd: string;
  readUnifiedSources: () => Promise<{ index: SourcesIndex; sources: SourceView[] }>;
}

const IGNORED_DIRS = new Set([".git", "node_modules"]);
const DEFAULT_MAX_RESULTS = 100;
const DEFAULT_AST_LIMIT = 250;
const DEFAULT_MAX_CHARS = 8_000;
const DEFAULT_MATCH_SNIPPET_CHARS = 220;
const DEFAULT_ROW_VALUE_CHARS = 320;
const DEFAULT_TREE_LINES = 120;
const DEFAULT_READ_CONTEXT = 20;
const MUTATION_LOCK_NAME = ".getsrc-mutation.lock";
const MUTATION_LOCK_TIMEOUT_MS = 20_000;
const MUTATION_LOCK_RETRY_MS = 120;
const AST_GREP_PACKAGE = "@ast-grep/napi";
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
  console.error(`getsrc: fetch/query dependency source code without MCP

Usage:
  skillx getsrc list [--fields f1,f2] [--max-items N]
  skillx getsrc has <name|id> [--version <version>]
  skillx getsrc get <source|id>
  skillx getsrc resolve <spec>
  skillx getsrc fetch <spec...> [--modify true|false] [--logs true]
  skillx getsrc remove <source|id...> [--logs true]
  skillx getsrc clean [--packages] [--repos] [--npm] [--pypi] [--crates] [--logs true]
  skillx getsrc files <source|id> [--glob <pattern>] [--type file|dir|all] [--fields f1,f2] [--max-items N]
  skillx getsrc tree <source|id> [--depth N] [--pattern <glob>] [--max-items N]
  skillx getsrc grep <pattern> [--sources <a,b>] [--include <glob>] [--max-results N] [--ignore-case true|false]
  skillx getsrc ast-grep <source|id> <pattern> [--glob <glob>] [--lang <lang|a,b>] [--limit N]
  skillx getsrc read <source|id> <path> [--start N --end N] [--around N --before N --after N]
  skillx getsrc read-many <source|id> <path...> [--start N --end N] [--around N --before N --after N]
  skillx getsrc batch "<cmd...>" "<cmd...>" [...]
  skillx getsrc serve

Global output flags:
  --fields <a,b,c>   Select output fields for row-based commands
  --max-items <n>    Cap number of rows/files/lines shown
  --max-chars <n>    Cap read/search payload size (search snippets default to ${DEFAULT_MATCH_SNIPPET_CHARS})
  --no-meta true     Omit summary headers
  --no-null true     Omit null/empty fields in rows
  --long true        Include extra metadata fields
  --logs true        Include backend stdout/stderr for fetch/remove/clean

Source selectors:
  Most commands accept source name or source id from list (e.g., s_2p3r1m)

Batch:
  Each positional arg is one subcommand string (without the leading 'getsrc').
  Example:
    skillx getsrc batch "fetch npm:react@18.3.1" "grep useState --sources s_abc123"
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

function toOptionalInt(value: string | boolean | undefined): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number.parseInt(String(value), 10);
  if (!Number.isFinite(n)) return null;
  return n;
}

function toBool(value: string | boolean | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  if (typeof value === "boolean") return value;
  const s = value.trim().toLowerCase();
  if (s === "true" || s === "1" || s === "yes" || s === "on") return true;
  if (s === "false" || s === "0" || s === "no" || s === "off") return false;
  return fallback;
}

function parseCsv(value: string | boolean | undefined): string[] | null {
  if (typeof value !== "string") return null;
  const out = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return out.length > 0 ? out : null;
}

function parsePositiveIntFlag(name: string, value: string | boolean | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = Number.parseInt(String(value), 10);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`--${name} must be a positive integer`);
  }
  return n;
}

function buildRenderOptions(flags: Record<string, string | boolean>, inherited?: RenderOptions): RenderOptions {
  const localMaxItems = parsePositiveIntFlag("max-items", flags["max-items"]);
  const localMaxChars = parsePositiveIntFlag("max-chars", flags["max-chars"]);
  const hasLocalMaxChars = localMaxChars !== undefined;
  return {
    fields: parseCsv(flags.fields) ?? inherited?.fields ?? null,
    maxItems: localMaxItems ?? inherited?.maxItems ?? null,
    maxChars: localMaxChars ?? inherited?.maxChars ?? null,
    maxCharsProvided: hasLocalMaxChars || (inherited?.maxCharsProvided ?? false),
    noMeta:
      flags["no-meta"] !== undefined
        ? toBool(flags["no-meta"], false)
        : (inherited?.noMeta ?? false),
    noNull:
      flags["no-null"] !== undefined
        ? toBool(flags["no-null"], false)
        : (inherited?.noNull ?? true),
    logs:
      flags.logs !== undefined
        ? toBool(flags.logs, false)
        : (inherited?.logs ?? false),
    long:
      flags.long !== undefined
        ? toBool(flags.long, false)
        : (inherited?.long ?? false),
  };
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

  return {
    // Backend CLI still writes to the legacy store by default.
    // Prefer the new store only when it already has an index.
    getsrcDir: preferredHasIndex ? preferredDir : fallbackDir,
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

function shortHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const normalized = hash >>> 0;
  return normalized.toString(36);
}

function sourceKey(source: Source): string {
  return `${source.type}:${source.name}:${source.version ?? source.ref ?? ""}`;
}

function sourceLabel(source: Source): string {
  if (source.type === "repo") {
    return source.ref ? `${source.name}@${source.ref}` : source.name;
  }
  return source.version ? `${source.name}@${source.version}` : source.name;
}

function toUnifiedSources(index: SourcesIndex): SourceView[] {
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

  return out.map((source) => {
    const id = `s_${shortHash(sourceKey(source))}`;
    return {
      ...source,
      id,
      label: sourceLabel(source),
    };
  });
}

function resolveSourceOrThrow(sources: SourceView[], token: string): SourceView {
  const exactName = sources.filter((s) => s.name === token);
  if (exactName.length === 1) return exactName[0];
  if (exactName.length > 1) {
    const ids = exactName.map((s) => s.id).join(", ");
    throw new Error(`Source name is ambiguous: ${token}. Use source id (${ids}) instead.`);
  }

  const exactId = sources.find((s) => s.id === token);
  if (exactId) return exactId;

  const prefixMatches = sources.filter((s) => s.id.startsWith(token));
  if (prefixMatches.length === 1) return prefixMatches[0];
  if (prefixMatches.length > 1) {
    throw new Error(`Source id prefix is ambiguous: ${token}`);
  }

  throw new Error(`Source not found: ${token}`);
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
    maxBuffer: 20 * 1024 * 1024,
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

async function loadAstGrepNapi(): Promise<AstGrepNapiModule> {
  try {
    return (await import(AST_GREP_PACKAGE)) as AstGrepNapiModule;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to load ast-grep dependency: ${msg}. Enable Bun auto-install or preinstall @ast-grep/napi.`);
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

function clipText(text: string, maxChars: number | null): { text: string; truncated: boolean } {
  if (!Number.isFinite(maxChars as number) || maxChars === null || maxChars <= 0) {
    return { text, truncated: false };
  }
  if (text.length <= maxChars) {
    return { text, truncated: false };
  }
  return {
    text: `${text.slice(0, maxChars)}\n... [truncated ${text.length - maxChars} chars]`,
    truncated: true,
  };
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function formatScalar(value: unknown, options: RenderOptions, collapse = true): string {
  if (value === null || value === undefined) return "-";
  const scalarLimit = DEFAULT_ROW_VALUE_CHARS;
  if (typeof value === "string") {
    const base = collapse ? oneLine(value) : value;
    const clipped = clipText(base, scalarLimit).text.replace(/\n+/g, " ");
    if (collapse) return clipped;
    return clipped;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((v) => formatScalar(v, options, true)).join(",");
  }
  return clipText(JSON.stringify(value), scalarLimit).text.replace(/\n+/g, " ");
}

function pickFields(defaultFields: string[], options: RenderOptions): string[] {
  if (!options.fields || options.fields.length === 0) return defaultFields;
  return options.fields;
}

function formatRows(
  rows: Array<Record<string, unknown>>,
  defaultFields: string[],
  options: RenderOptions,
  meta?: { title?: string; total?: number }
): string {
  const selectedFields = pickFields(defaultFields, options);
  const maxItems = options.maxItems ?? rows.length;
  const shown = rows.slice(0, Math.max(0, maxItems));

  const lines: string[] = [];
  if (!options.noMeta) {
    const total = meta?.total ?? rows.length;
    const title = meta?.title ?? "rows";
    lines.push(`${title}: ${shown.length}/${total}`);
  }

  for (const row of shown) {
    const parts: string[] = [];
    for (const field of selectedFields) {
      if (!(field in row)) continue;
      const value = row[field];
      if (options.noNull && (value === null || value === undefined || value === "")) continue;
      parts.push(`${field}=${formatScalar(value, options)}`);
    }
    lines.push(parts.length > 0 ? `- ${parts.join(" | ")}` : "- (empty)");
  }

  if (rows.length > shown.length) {
    lines.push(`... +${rows.length - shown.length} more`);
  }

  return lines.join("\n");
}

function buildSourceRow(source: SourceView, options: RenderOptions): Record<string, unknown> {
  return {
    id: source.id,
    type: source.type,
    name: source.name,
    label: source.label,
    version: source.version ?? null,
    ref: source.ref ?? null,
    path: source.path,
    repository: source.repository,
    fetchedAt: source.fetchedAt,
    ...(options.long ? { key: sourceKey(source) } : {}),
  };
}

function fileIdFor(sourceId: string, path: string): string {
  return `f_${shortHash(`${sourceId}:${path}`)}`;
}

function splitCommandLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;
  let escaped = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];

    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      escaped = true;
      continue;
    }

    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        current += ch;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }

    if (/\s/.test(ch)) {
      if (current.length > 0) {
        out.push(current);
        current = "";
      }
      continue;
    }

    current += ch;
  }

  if (current.length > 0) {
    out.push(current);
  }

  return out;
}

async function readPipedStdin(): Promise<string> {
  if (process.stdin.isTTY) return "";

  let data = "";
  for await (const chunk of process.stdin) {
    data += String(chunk);
  }
  return data;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => {
    setTimeout(resolveSleep, ms);
  });
}

async function withMutationLock<T>(getsrcDir: string, run: () => Promise<T>): Promise<T> {
  const lockPath = join(getsrcDir, MUTATION_LOCK_NAME);
  await mkdir(getsrcDir, { recursive: true });
  const startedAt = Date.now();

  while (true) {
    try {
      await mkdir(lockPath);
      break;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException | null)?.code;
      if (code !== "EEXIST") {
        throw err;
      }

      if (Date.now() - startedAt > MUTATION_LOCK_TIMEOUT_MS) {
        throw new Error(`Timed out waiting for mutation lock (${MUTATION_LOCK_TIMEOUT_MS}ms)`);
      }

      await sleep(MUTATION_LOCK_RETRY_MS);
    }
  }

  try {
    return await run();
  } finally {
    await rm(lockPath, { recursive: true, force: true });
  }
}

function computeReadSlice(
  content: string,
  flags: Record<string, string | boolean>
): ReadSlice {
  const lines = content.split("\n");
  const total = lines.length;
  if (total === 0) {
    return { start: 0, end: 0, total: 0, lines: [] };
  }

  const around = toOptionalInt(flags.around);
  const before = Math.max(0, toOptionalInt(flags.before) ?? DEFAULT_READ_CONTEXT);
  const after = Math.max(0, toOptionalInt(flags.after) ?? DEFAULT_READ_CONTEXT);

  let start = Math.max(1, toOptionalInt(flags.start) ?? 1);
  let end = Math.max(start, toOptionalInt(flags.end) ?? total);

  if (around !== null) {
    const center = Math.min(Math.max(1, around), total);
    start = Math.max(1, center - before);
    end = Math.min(total, center + after);
  }

  start = Math.min(start, total);
  end = Math.min(Math.max(start, end), total);

  const selected = lines.slice(start - 1, end);
  return {
    start,
    end,
    total,
    lines: selected,
  };
}

function renderReadSlice(
  path: string,
  slice: ReadSlice,
  options: RenderOptions,
  raw: boolean
): string {
  const body = raw
    ? slice.lines.join("\n")
    : slice.lines
        .map((line, idx) => {
          const lineNo = slice.start + idx;
          return `${String(lineNo).padStart(5, " ")} | ${line}`;
        })
        .join("\n");

  const clipLimit = options.maxCharsProvided ? options.maxChars : DEFAULT_MAX_CHARS;
  const clipped = clipText(body, clipLimit).text;

  if (options.noMeta) return clipped;
  return [
    `path: ${path}`,
    `range: ${slice.start}-${slice.end} of ${slice.total}`,
    clipped,
  ].join("\n");
}

async function buildTree(
  sourceRoot: string,
  rootName: string,
  depth: number,
  pattern: string | null
): Promise<TreeNode | null> {
  const matcher = pattern ? globToRegex(pattern) : null;

  async function buildNode(absDir: string, relDir: string, level: number): Promise<TreeNode | null> {
    if (level > depth) return null;

    const children: TreeNode[] = [];
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
      } else if (!matcher || matcher.test(relPath)) {
        children.push({ name: dirent.name, type: "file" });
      }
    }

    children.sort((a, b) => a.name.localeCompare(b.name));
    const nodeName = relDir ? relDir.split("/").at(-1) ?? relDir : rootName;
    return { name: nodeName, type: "dir", children };
  }

  return buildNode(sourceRoot, "", 1);
}

function renderTreeLines(node: TreeNode): string[] {
  const lines: string[] = [];

  function walk(current: TreeNode, prefix: string, isLast: boolean, isRoot: boolean): void {
    const connector = isRoot ? "" : (isLast ? "`-- " : "|-- ");
    const suffix = current.type === "dir" ? "/" : "";
    lines.push(`${prefix}${connector}${current.name}${suffix}`);

    if (!current.children || current.children.length === 0) return;

    const childPrefix = isRoot ? "" : `${prefix}${isLast ? "    " : "|   "}`;
    current.children.forEach((child, index) => {
      const childIsLast = index === current.children!.length - 1;
      walk(child, childPrefix, childIsLast, false);
    });
  }

  walk(node, "", true, true);
  return lines;
}

async function runCommand(parsed: ParsedArgs, context: CommandContext, inheritedRender?: RenderOptions): Promise<string> {
  const { positional, flags } = parsed;
  const cmd = positional[0];
  const render = buildRenderOptions(flags, inheritedRender);

  if (!cmd || cmd === "-h" || cmd === "--help" || cmd === "help") {
    return "help: run `skillx getsrc help`";
  }

  if (cmd === "list") {
    const { index, sources } = await context.readUnifiedSources();
    const rows = sources
      .map((source) => buildSourceRow(source, render))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));

    const title = render.noMeta ? undefined : `sources (updatedAt=${index.updatedAt ?? "-"})`;
    return formatRows(rows, ["id", "type", "label", "path"], render, {
      title,
      total: rows.length,
    });
  }

  if (cmd === "has") {
    const token = positional[1];
    if (!token) throw new Error("Usage: has <name|id> [--version <version>]");

    const { sources } = await context.readUnifiedSources();
    const version = typeof flags.version === "string" ? flags.version : undefined;
    const byId = sources.find((s) => s.id === token);
    const match = byId
      ? (!version || byId.version === version || byId.ref === version ? byId : undefined)
      : sources.find((s) => s.name === token && (!version || s.version === version || s.ref === version));

    if (render.noMeta) {
      return match ? "true" : "false";
    }

    const row = {
      has: Boolean(match),
      query: token,
      version: version ?? null,
      sourceId: match?.id ?? null,
      label: match?.label ?? null,
    };

    return formatRows([row], ["has", "query", "version", "sourceId", "label"], render, {
      title: "has",
      total: 1,
    });
  }

  if (cmd === "get") {
    const token = positional[1];
    if (!token) throw new Error("Usage: get <source|id>");

    const { sources } = await context.readUnifiedSources();
    const source = resolveSourceOrThrow(sources, token);
    return formatRows([buildSourceRow(source, render)], ["id", "type", "label", "path"], render, {
      title: "source",
      total: 1,
    });
  }

  if (cmd === "resolve") {
    const spec = positional[1];
    if (!spec) throw new Error("Usage: resolve <spec>");

    const parsedSpec = parseSpec(spec);
    const row: Record<string, unknown> = {
      input: spec,
      type: parsedSpec.type,
      name: parsedSpec.name,
      version: "version" in parsedSpec ? parsedSpec.version ?? null : null,
      ref: "ref" in parsedSpec ? parsedSpec.ref ?? null : null,
      repoUrl: "repoUrl" in parsedSpec ? parsedSpec.repoUrl : null,
    };
    return formatRows([row], ["input", "type", "name", "version", "ref", "repoUrl"], render, {
      title: "resolved",
      total: 1,
    });
  }

  if (cmd === "fetch") {
    const specs = positional.slice(1);
    if (specs.length === 0) throw new Error("Usage: fetch <spec...> [--modify true|false]");

    const modify = toBool(flags.modify, false);
    const normalizedSpecs = specs.map(normalizeRepoPrefix);
    const backendArgs = ["--modify", String(modify), ...normalizedSpecs];

    const { before, after, result } = await withMutationLock(context.getsrcDir, async () => {
      const beforeLocked = (await context.readUnifiedSources()).sources;
      const resultLocked = runGetsrcBackend(backendArgs, context.getsrcCwd);
      const afterLocked = (await context.readUnifiedSources()).sources;
      return {
        before: beforeLocked,
        after: afterLocked,
        result: resultLocked,
      };
    });

    const beforeSet = new Set(before.map((s) => `${s.type}:${s.name}:${s.version ?? s.ref ?? ""}`));
    const added = after.filter((s) => !beforeSet.has(`${s.type}:${s.name}:${s.version ?? s.ref ?? ""}`));

    const rows = added.map((source) => buildSourceRow(source, render));
    const base = formatRows(rows, ["id", "type", "label", "path"], render, {
      title: `fetch (modify=${modify})`,
      total: rows.length,
    });

    if (!render.logs) return base;

    const logLines = [
      base,
      result.stdout.trim() ? `stdout:\n${result.stdout.trim()}` : "stdout: -",
      result.stderr.trim() ? `stderr:\n${result.stderr.trim()}` : "stderr: -",
    ];
    return logLines.join("\n");
  }

  if (cmd === "remove") {
    const tokens = positional.slice(1);
    if (tokens.length === 0) throw new Error("Usage: remove <source|id...>");

    const { sources } = await context.readUnifiedSources();
    const names = tokens.map((token) => resolveSourceOrThrow(sources, token).name);

    const { before, after, result } = await withMutationLock(context.getsrcDir, async () => {
      const beforeLocked = (await context.readUnifiedSources()).sources;
      const resultLocked = runGetsrcBackend(["remove", ...names], context.getsrcCwd);
      const afterLocked = (await context.readUnifiedSources()).sources;
      return {
        before: beforeLocked,
        after: afterLocked,
        result: resultLocked,
      };
    });

    const afterKeys = new Set(after.map(sourceKey));
    const removed = before.filter((source) => !afterKeys.has(sourceKey(source)));

    const rows = removed.map((source) => ({ id: source.id, type: source.type, label: source.label }));
    const base = formatRows(rows, ["id", "type", "label"], render, {
      title: "removed",
      total: rows.length,
    });

    if (!render.logs) return base;

    return [
      base,
      result.stdout.trim() ? `stdout:\n${result.stdout.trim()}` : "stdout: -",
      result.stderr.trim() ? `stderr:\n${result.stderr.trim()}` : "stderr: -",
    ].join("\n");
  }

  if (cmd === "clean") {
    const cleanArgs = ["clean"];
    const selectorKeys = ["packages", "repos", "npm", "pypi", "crates"] as const;
    let hasSelectorFlag = false;
    let hasEnabledSelector = false;

    for (const key of selectorKeys) {
      if (flags[key] === undefined) continue;
      hasSelectorFlag = true;
      const enabled = toBool(flags[key], false);
      if (enabled) {
        hasEnabledSelector = true;
        cleanArgs.push(`--${key}`);
      }
    }

    if (hasSelectorFlag && !hasEnabledSelector) {
      return render.noMeta ? "clean: no-op" : "cleaned: 0/0 (all selectors false)";
    }

    const { before, after, result } = await withMutationLock(context.getsrcDir, async () => {
      const beforeLocked = (await context.readUnifiedSources()).sources;
      const resultLocked = runGetsrcBackend(cleanArgs, context.getsrcCwd);
      const afterLocked = (await context.readUnifiedSources()).sources;
      return {
        before: beforeLocked,
        after: afterLocked,
        result: resultLocked,
      };
    });
    const afterSet = new Set(after.map(sourceKey));
    const removed = before.filter((s) => !afterSet.has(sourceKey(s)));

    const rows = removed.map((source) => ({ id: source.id, type: source.type, label: source.label }));
    const base = formatRows(rows, ["id", "type", "label"], render, {
      title: "cleaned",
      total: rows.length,
    });

    if (!render.logs) return base;

    return [
      base,
      result.stdout.trim() ? `stdout:\n${result.stdout.trim()}` : "stdout: -",
      result.stderr.trim() ? `stderr:\n${result.stderr.trim()}` : "stderr: -",
    ].join("\n");
  }

  if (cmd === "files") {
    const token = positional[1];
    if (!token) throw new Error("Usage: files <source|id> [--glob <pattern>]");

    const glob = String(flags.glob ?? "**/*");
    const typeFilter = String(flags.type ?? "file").toLowerCase();
    if (!["file", "dir", "all"].includes(typeFilter)) {
      throw new Error("Usage: files <source|id> [--glob <pattern>] [--type file|dir|all]");
    }
    const matcher = globToRegex(glob);
    const { sources } = await context.readUnifiedSources();
    const source = resolveSourceOrThrow(sources, token);
    const sourceRoot = resolveInRoot(context.getsrcDir, source.path);

    const entries: Array<Record<string, unknown>> = [];
    await walkAllEntries(sourceRoot, async ({ relPath, entry, st }) => {
      if (glob === "**/*" || matcher.test(relPath) || (entry.isDirectory() && matcher.test(`${relPath}/`))) {
        const kind = entry.isDirectory() ? "dir" : "file";
        if (typeFilter !== "all" && kind !== typeFilter) return;
        entries.push({
          sourceId: source.id,
          fileId: fileIdFor(source.id, relPath),
          path: relPath,
          kind,
          size: kind === "dir" ? 0 : st.size,
        });
      }
    });

    entries.sort((a, b) => String(a.path).localeCompare(String(b.path)));

    return formatRows(entries, ["fileId", "path", "kind", "size"], render, {
      title: `files(${source.id}) glob=${glob}`,
      total: entries.length,
    });
  }

  if (cmd === "tree") {
    const token = positional[1];
    if (!token) throw new Error("Usage: tree <source|id> [--depth <n>] [--pattern <glob>]");

    const depth = Math.max(1, toInt(flags.depth, 3));
    const pattern = typeof flags.pattern === "string" ? flags.pattern : null;

    const { sources } = await context.readUnifiedSources();
    const source = resolveSourceOrThrow(sources, token);
    const sourceRoot = resolveInRoot(context.getsrcDir, source.path);

    const tree = await buildTree(sourceRoot, source.label, depth, pattern);
    if (!tree) return render.noMeta ? "" : `tree: 0`;

    const lines = renderTreeLines(tree);
    const lineCap = Math.max(1, render.maxItems ?? DEFAULT_TREE_LINES);
    const shown = lines.slice(0, lineCap);

    if (render.noMeta) {
      const out = [...shown];
      if (lines.length > shown.length) {
        out.push(`... +${lines.length - shown.length} more lines`);
      }
      return out.join("\n");
    }

    const out: string[] = [`tree(${source.id}) depth=${depth}${pattern ? ` pattern=${pattern}` : ""}`];
    out.push(...shown);
    if (lines.length > shown.length) {
      out.push(`... +${lines.length - shown.length} more lines`);
    }
    return out.join("\n");
  }

  if (cmd === "read") {
    const token = positional[1];
    const filePath = positional[2];
    if (!token || !filePath) throw new Error("Usage: read <source|id> <path>");

    const { sources } = await context.readUnifiedSources();
    const source = resolveSourceOrThrow(sources, token);
    const sourceRoot = resolveInRoot(context.getsrcDir, source.path);
    const absFile = resolveInRoot(sourceRoot, filePath);
    const content = await readFile(absFile, "utf8");

    const slice = computeReadSlice(content, flags);
    return renderReadSlice(filePath, slice, render, toBool(flags.raw, false));
  }

  if (cmd === "read-many") {
    const token = positional[1];
    const requested = positional.slice(2);
    if (!token || requested.length === 0) {
      throw new Error("Usage: read-many <source|id> <path...>");
    }

    const { sources } = await context.readUnifiedSources();
    const source = resolveSourceOrThrow(sources, token);
    const sourceRoot = resolveInRoot(context.getsrcDir, source.path);

    const expanded: string[] = [];

    for (const requestedPath of requested) {
      if (!hasGlobChars(requestedPath)) {
        expanded.push(requestedPath);
        continue;
      }

      const rg = runCmd(
        "rg",
        ["--files", "--glob", requestedPath, "--glob", "!**/node_modules/**", "--glob", "!**/.git/**"],
        sourceRoot
      );

      if (rg.status === 0) {
        for (const line of rg.stdout.split("\n")) {
          const trimmed = line.trim();
          if (trimmed) expanded.push(trimmed);
        }
      }
    }

    const unique = [...new Set(expanded)].sort((a, b) => a.localeCompare(b));
    const maxFiles = render.maxItems ?? unique.length;
    const selected = unique.slice(0, Math.max(0, maxFiles));
    const raw = toBool(flags.raw, false);

    const blocks: string[] = [];

    if (!render.noMeta) {
      blocks.push(`read-many(${source.id}): ${selected.length}/${unique.length} file(s)`);
    }

    for (const relPath of selected) {
      try {
        const absPath = resolveInRoot(sourceRoot, relPath);
        const content = await readFile(absPath, "utf8");
        const slice = computeReadSlice(content, flags);
        const block = renderReadSlice(relPath, slice, render, raw);
        blocks.push(block);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        blocks.push(`path: ${relPath}\nerror: ${msg}`);
      }
    }

    if (unique.length > selected.length) {
      blocks.push(`... +${unique.length - selected.length} more file(s)`);
    }

    return blocks.join("\n\n");
  }

  if (cmd === "grep") {
    const pattern = positional[1];
    if (!pattern) {
      throw new Error("Usage: grep <pattern> [--sources <a,b>] [--include <glob>] [--max-results <n>] [--ignore-case true|false]");
    }

    const include = String(flags.include ?? "**/*");
    const maxResults = Math.max(1, toInt(flags["max-results"], DEFAULT_MAX_RESULTS));
    const ignoreCase = toBool(flags["ignore-case"], false);

    const { sources } = await context.readUnifiedSources();
    const sourceFilterTokens = parseCsv(flags.sources);
    const selected = sourceFilterTokens
      ? sourceFilterTokens.map((token) => resolveSourceOrThrow(sources, token).id)
      : null;
    const selectedSet = selected ? new Set(selected) : null;

    const filteredSources = selectedSet ? sources.filter((s) => selectedSet.has(s.id)) : sources;

    const matches: Array<Record<string, unknown>> = [];

    for (const source of filteredSources) {
      if (matches.length >= maxResults) break;

      const sourceRoot = resolveInRoot(context.getsrcDir, source.path);
      const rgArgs = [
        "--json",
        "--line-number",
        "--glob",
        include,
        "--glob",
        "!**/node_modules/**",
        "--glob",
        "!**/.git/**",
        pattern,
        ".",
      ];
      if (ignoreCase) {
        rgArgs.splice(2, 0, "--ignore-case");
      }
      const rg = runCmd(
        "rg",
        rgArgs,
        sourceRoot
      );

      if (rg.status !== 0 && rg.status !== 1) {
        throw new Error(rg.stderr || rg.stdout || `rg failed for ${source.id}`);
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
        const relFile = String(data.path.text).replace(/^\.\//, "");
        const content = oneLine(String(data.lines.text ?? ""));
        const snippetMax = render.maxCharsProvided ? render.maxChars : DEFAULT_MATCH_SNIPPET_CHARS;

        matches.push({
          sourceId: source.id,
          fileId: fileIdFor(source.id, relFile),
          file: relFile,
          line: data.line_number,
          content: clipText(content, snippetMax).text,
        });

        if (matches.length >= maxResults) break;
      }
    }

    return formatRows(matches, ["sourceId", "file", "line", "content"], render, {
      title: `grep pattern=${pattern}`,
      total: matches.length,
    });
  }

  if (cmd === "ast-grep") {
    const token = positional[1];
    const pattern = positional[2];
    if (!token || !pattern) {
      throw new Error("Usage: ast-grep <source|id> <pattern> [--glob <glob>] [--lang <lang|a,b>] [--limit <n>]");
    }

    const glob = String(flags.glob ?? "**/*");
    const limit = Math.max(1, toInt(flags.limit, DEFAULT_AST_LIMIT));
    const langFlag = parseCsv(flags.lang)?.map((l) => l.toLowerCase()) ?? null;

    const { sources } = await context.readUnifiedSources();
    const source = resolveSourceOrThrow(sources, token);
    const sourceRoot = resolveInRoot(context.getsrcDir, source.path);

    const matches = await runAstGrepSearch({
      sourceRoot,
      pattern,
      glob,
      limit,
      lang: langFlag,
    });

    const rows = matches.map((match) => {
      const snippetLimit = render.maxCharsProvided ? render.maxChars : DEFAULT_MATCH_SNIPPET_CHARS;
      const base: Record<string, unknown> = {
        sourceId: source.id,
        fileId: fileIdFor(source.id, match.file),
        file: match.file,
        line: match.line,
        column: match.column,
        text: clipText(oneLine(match.text), snippetLimit).text,
      };

      if (render.long) {
        base.endLine = match.endLine;
        base.endColumn = match.endColumn;
      }

      if (render.long && Object.keys(match.metavars).length > 0) {
        base.metavars = Object.entries(match.metavars)
          .map(([k, v]) => `${k}=${oneLine(v)}`)
          .join(", ");
      }

      return base;
    });

    return formatRows(rows, ["sourceId", "file", "line", "column", "text", "metavars"], render, {
      title: `ast-grep(${source.id})`,
      total: rows.length,
    });
  }

  if (cmd === "batch") {
    const ops = positional.slice(1).filter(Boolean);
    const piped = (await readPipedStdin()).trim();
    if (ops.length === 0 && !piped) {
      throw new Error("Usage: batch \"<cmd...>\" \"<cmd...>\" [...]  (or pipe lines to stdin)");
    }

    const pipedOps = piped
      ? piped
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
      : [];

    const allOps = [...ops, ...pipedOps];
    const blocks: string[] = [];

    if (!render.noMeta) {
      blocks.push(`batch: ${allOps.length} op(s)`);
    }

    for (let i = 0; i < allOps.length; i += 1) {
      const op = allOps[i];
      const tokens = splitCommandLine(op);
      if (tokens.length === 0) continue;

      const childParsed = parseArgv(tokens);
      const childCmd = childParsed.positional[0];
      if (childCmd === "batch" || childCmd === "serve") {
        throw new Error(`batch does not allow nested ${childCmd}`);
      }

      try {
        const result = await runCommand(childParsed, context, render);
        if (render.noMeta) {
          blocks.push(result);
        } else {
          blocks.push(`[${i + 1}] ${op}`);
          blocks.push(result);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (render.noMeta) {
          blocks.push(`error: ${msg}`);
        } else {
          blocks.push(`[${i + 1}] ${op}`);
          blocks.push(`error: ${msg}`);
        }
      }
    }

    return blocks.join("\n\n");
  }

  if (cmd === "serve") {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: process.stdin.isTTY,
    });

    const out: string[] = [];
    if (!render.noMeta) {
      out.push("serve: ready (type commands without 'getsrc'; type 'exit' to quit)");
    }

    const processLine = async (line: string): Promise<string> => {
      const trimmed = line.trim();
      if (!trimmed) return "";
      if (trimmed === "exit" || trimmed === "quit") return "__EXIT__";

      const tokens = splitCommandLine(trimmed);
      if (tokens.length === 0) return "";

      const child = parseArgv(tokens);
      const childCmd = child.positional[0];
      if (childCmd === "serve") {
        return "error: nested serve is not allowed";
      }

      try {
        const result = await runCommand(child, context, render);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return `error: ${msg}`;
      }
    };

    if (!process.stdin.isTTY) {
      for await (const line of rl) {
        const result = await processLine(line);
        if (!result) continue;
        if (result === "__EXIT__") break;
        out.push(result);
      }
      rl.close();
      return out.join("\n\n");
    }

    process.stdout.write(`${out.join("\n")}\n`);
    for await (const line of rl) {
      const result = await processLine(line);
      if (!result) continue;
      if (result === "__EXIT__") break;
      process.stdout.write(`${result}\n\n`);
    }

    rl.close();
    return "";
  }

  throw new Error(`Unknown command: ${cmd}`);
}

async function main(): Promise<void> {
  const parsed = parseArgv(process.argv.slice(2));

  if (parsed.positional.length === 0 || ["-h", "--help", "help"].includes(parsed.positional[0])) {
    usage();
    process.exit(parsed.positional.length === 0 ? 1 : 0);
  }

  const { getsrcDir, getsrcCwd } = getPaths();
  process.env[LEGACY_DIR_ENV] = getsrcDir;
  await mkdir(getsrcCwd, { recursive: true });

  const context: CommandContext = {
    getsrcDir,
    getsrcCwd,
    readUnifiedSources: async (): Promise<{ index: SourcesIndex; sources: SourceView[] }> => {
      const index = await readSourcesIndex(getsrcDir);
      return {
        index,
        sources: toUnifiedSources(index),
      };
    },
  };

  try {
    const output = await runCommand(parsed, context);
    if (output) {
      process.stdout.write(`${output}\n`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`error: ${message}\n`);
    process.exit(1);
  }
}

void main();
