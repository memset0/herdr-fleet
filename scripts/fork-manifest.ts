export type ForkStrategy = "keep" | "adapt" | "replace-with-upstream" | "drop";

export interface ForkUpstream {
  url: string;
  tag: string;
  commit: string;
}

export interface ForkOwnedEntry {
  id: string;
  intent: string;
  paths: string[];
  contracts: string[];
  verify: string[];
}

export interface ForkInvasiveEntry {
  id: string;
  intent: string;
  strategy: ForkStrategy;
  review: "every-upstream-sync";
  paths: string[];
  verify: string[];
  reason: string;
  temporary_until?: string;
}

export interface ForkManifest {
  schema_version: 1;
  upstream: ForkUpstream;
  owned: ForkOwnedEntry[];
  invasive: ForkInvasiveEntry[];
}

type ParsedValue = string | number | string[];
type ParsedSection = Record<string, ParsedValue>;

const ROOT_KEYS = new Set(["schema_version"]);
const UPSTREAM_KEYS = new Set(["url", "tag", "commit"]);
const OWNED_KEYS = new Set(["id", "intent", "paths", "contracts", "verify"]);
const INVASIVE_KEYS = new Set([
  "id",
  "intent",
  "strategy",
  "review",
  "paths",
  "verify",
  "reason",
  "temporary_until",
]);
const STRATEGIES = new Set<ForkStrategy>([
  "keep",
  "adapt",
  "replace-with-upstream",
  "drop",
]);

function parseValue(raw: string, line: number): ParsedValue {
  if (/^[0-9]+$/.test(raw)) return Number(raw);
  if (raw.startsWith('"') || raw.startsWith("[")) {
    try {
      const value: unknown = JSON.parse(raw.replace(/,\s*]$/, "]"));
      if (typeof value === "string" || typeof value === "number") return value;
      if (Array.isArray(value) && value.every((item) => typeof item === "string")) return value;
    } catch {
      // The bounded diagnostic below is more useful than the JSON parser's implementation detail.
    }
  }
  throw new Error(`FORK.toml line ${line} has an unsupported value`);
}

function logicalLines(source: string): { line: number; value: string }[] {
  const physical = source.split(/\r?\n/);
  const lines: { line: number; value: string }[] = [];
  for (let index = 0; index < physical.length; index += 1) {
    const line = index + 1;
    let value = physical[index]!.trim();
    if (/^[a-z][a-z0-9_]*\s*=\s*\[/.test(value) && !value.endsWith("]")) {
      while (!value.endsWith("]")) {
        index += 1;
        if (index >= physical.length) throw new Error(`FORK.toml line ${line} has an unterminated array`);
        value += `\n${physical[index]!.trim()}`;
      }
    }
    lines.push({ line, value });
  }
  return lines;
}

function assign(section: ParsedSection, key: string, value: ParsedValue, line: number): void {
  if (Object.hasOwn(section, key)) throw new Error(`FORK.toml line ${line} repeats ${key}`);
  section[key] = value;
}

function exactKeys(section: ParsedSection, allowed: ReadonlySet<string>, label: string): void {
  for (const key of Object.keys(section)) {
    if (!allowed.has(key)) throw new Error(`${label} has unknown field ${key}`);
  }
}

function stringValue(section: ParsedSection, key: string, label: string): string {
  const value = section[key];
  if (typeof value !== "string" || value.trim() !== value || value.length === 0) {
    throw new Error(`${label}.${key} must be a non-empty string`);
  }
  return value;
}

function stringList(section: ParsedSection, key: string, label: string): string[] {
  const value = section[key];
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => !item || item.trim() !== item)) {
    throw new Error(`${label}.${key} must be a non-empty string array`);
  }
  if (new Set(value).size !== value.length) throw new Error(`${label}.${key} contains a duplicate`);
  return [...value];
}

function safeRepositoryPath(path: string, label: string): void {
  const file = path.split("#", 1)[0] ?? "";
  if (
    !file ||
    file.startsWith("/") ||
    file.includes("\\") ||
    file.split("/").some((part) => !part || part === "." || part === "..")
  ) {
    throw new Error(`${label} contains unsafe path ${path}`);
  }
}

function ownedPath(path: string, label: string): void {
  safeRepositoryPath(path, label);
  if (path.includes("#") || /[*?\[]/.test(path.replace(/\/\*\*$/, ""))) {
    throw new Error(`${label} has an unsupported owned path ${path}`);
  }
  if (path.includes("*") && !path.endsWith("/**")) {
    throw new Error(`${label} owned globs must end with /**`);
  }
}

export function splitInvasivePath(value: string): { path: string; anchor: string } {
  const index = value.lastIndexOf("#");
  if (index <= 0 || index === value.length - 1) {
    throw new Error(`invasive path must contain an exact #anchor: ${value}`);
  }
  const path = value.slice(0, index);
  const anchor = value.slice(index + 1);
  safeRepositoryPath(path, "invasive.paths");
  if (/[*?\[]/.test(path) || !/^(?:deleted|[A-Za-z0-9_.:$-]+)$/.test(anchor)) {
    throw new Error(`invasive path is not exact: ${value}`);
  }
  return { path, anchor };
}

function validateVerification(paths: string[], label: string): void {
  for (const path of paths) {
    safeRepositoryPath(path, `${label}.verify`);
    if (/[*?#\[]/.test(path)) throw new Error(`${label}.verify must use exact paths`);
  }
}

export function parseForkManifest(source: string): ForkManifest {
  const root: ParsedSection = {};
  let upstream: ParsedSection | null = null;
  const owned: ParsedSection[] = [];
  const invasive: ParsedSection[] = [];
  let current = root;

  for (const { line, value } of logicalLines(source)) {
    if (!value || value.startsWith("#")) continue;
    if (value === "[upstream]") {
      if (upstream) throw new Error("FORK.toml repeats [upstream]");
      upstream = {};
      current = upstream;
      continue;
    }
    if (value === "[[owned]]" || value === "[[invasive]]") {
      const section: ParsedSection = {};
      (value === "[[owned]]" ? owned : invasive).push(section);
      current = section;
      continue;
    }
    if (value.startsWith("[")) throw new Error(`FORK.toml line ${line} has an unknown section`);
    const match = /^([a-z][a-z0-9_]*)\s*=\s*([\s\S]+)$/.exec(value);
    if (!match) throw new Error(`FORK.toml line ${line} is malformed`);
    assign(current, match[1]!, parseValue(match[2]!, line), line);
  }

  exactKeys(root, ROOT_KEYS, "FORK.toml root");
  if (root.schema_version !== 1) throw new Error("FORK.toml schema_version must be 1");
  if (!upstream) throw new Error("FORK.toml requires [upstream]");
  exactKeys(upstream, UPSTREAM_KEYS, "upstream");
  const normalizedUpstream = {
    url: stringValue(upstream, "url", "upstream"),
    tag: stringValue(upstream, "tag", "upstream"),
    commit: stringValue(upstream, "commit", "upstream"),
  };
  if (!/^https:\/\/[A-Za-z0-9./_-]+\.git$/.test(normalizedUpstream.url)) {
    throw new Error("upstream.url must be an HTTPS Git URL");
  }
  if (!/^v\d+\.\d+\.\d+$/.test(normalizedUpstream.tag)) throw new Error("upstream.tag is malformed");
  if (!/^[0-9a-f]{40}$/.test(normalizedUpstream.commit)) throw new Error("upstream.commit is malformed");

  const ids = new Set<string>();
  const paths = new Set<string>();
  const normalizedOwned = owned.map((section, index) => {
    const label = `owned[${index}]`;
    exactKeys(section, OWNED_KEYS, label);
    const entry: ForkOwnedEntry = {
      id: stringValue(section, "id", label),
      intent: stringValue(section, "intent", label),
      paths: stringList(section, "paths", label),
      contracts: stringList(section, "contracts", label),
      verify: stringList(section, "verify", label),
    };
    if (ids.has(entry.id)) throw new Error(`duplicate fork entry id ${entry.id}`);
    ids.add(entry.id);
    for (const path of entry.paths) {
      ownedPath(path, label);
      if (paths.has(path)) throw new Error(`duplicate fork path ${path}`);
      paths.add(path);
    }
    validateVerification(entry.verify, label);
    return entry;
  });

  const normalizedInvasive = invasive.map((section, index) => {
    const label = `invasive[${index}]`;
    exactKeys(section, INVASIVE_KEYS, label);
    const strategy = stringValue(section, "strategy", label) as ForkStrategy;
    if (!STRATEGIES.has(strategy)) throw new Error(`${label}.strategy is invalid`);
    const review = stringValue(section, "review", label);
    if (review !== "every-upstream-sync") throw new Error(`${label}.review must be every-upstream-sync`);
    const entry: ForkInvasiveEntry = {
      id: stringValue(section, "id", label),
      intent: stringValue(section, "intent", label),
      strategy,
      review,
      paths: stringList(section, "paths", label),
      verify: stringList(section, "verify", label),
      reason: stringValue(section, "reason", label),
      ...(section.temporary_until === undefined
        ? {}
        : { temporary_until: stringValue(section, "temporary_until", label) }),
    };
    if (ids.has(entry.id)) throw new Error(`duplicate fork entry id ${entry.id}`);
    ids.add(entry.id);
    for (const path of entry.paths) {
      splitInvasivePath(path);
      if (paths.has(path)) throw new Error(`duplicate fork path ${path}`);
      paths.add(path);
    }
    validateVerification(entry.verify, label);
    return entry;
  });

  if (normalizedOwned.length === 0 || normalizedInvasive.length === 0) {
    throw new Error("FORK.toml requires owned and invasive entries");
  }
  return {
    schema_version: 1,
    upstream: normalizedUpstream,
    owned: normalizedOwned,
    invasive: normalizedInvasive,
  };
}

export async function loadForkManifest(
  path: string | URL = new URL("../FORK.toml", import.meta.url),
): Promise<ForkManifest> {
  return parseForkManifest(await Bun.file(path).text());
}
