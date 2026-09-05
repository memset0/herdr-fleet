import { jsonRecord, jsonStringField } from "../bridge/stt/json.ts";
import type { JsonObject, JsonValue } from "../bridge/json.ts";

export type ForkStrategy = "keep" | "adapt" | "drop";

export interface ForkUpstream {
  readonly url: string;
  readonly tag: string;
  readonly tag_object: string;
  readonly commit: string;
}

export interface ForkOwnedEntry {
  readonly id: string;
  readonly intent: string;
  readonly paths: readonly string[];
  readonly contracts: readonly string[];
  readonly verify: readonly string[];
}

export interface ForkInvasiveEntry {
  readonly id: string;
  readonly intent: string;
  readonly strategy: ForkStrategy;
  readonly review: "every-upstream-sync";
  readonly reviewed: string;
  readonly paths: readonly string[];
  readonly verify: readonly string[];
  readonly reason: string;
}

export interface ForkManifest {
  readonly schema_version: 2;
  readonly upstream: ForkUpstream;
  readonly owned: readonly ForkOwnedEntry[];
  readonly invasive: readonly ForkInvasiveEntry[];
}

// The upstream release identifier, shared by the adopted tag and by the release each invasive entry
// was last reviewed against — they are compared to each other, so they must be the same shape.
const TAG_PATTERN = /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function table(value: JsonValue | undefined, label: string): JsonObject {
  const found = jsonRecord(value);
  if (found === null) throw new Error(`${label} must be a table`);
  return found;
}

function exactKeys(value: JsonObject, allowed: readonly string[], label: string): void {
  const extra = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extra.length > 0) throw new Error(`${label} has unknown field ${extra[0]}`);
}

function text(value: JsonValue | undefined, label: string): string {
  const found = jsonStringField(value);
  if (found === null || found === "" || found.trim() !== found) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return found;
}

function textList(value: JsonValue | undefined, label: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label} must be a non-empty string array`);
  }
  const strings: string[] = [];
  for (const item of value) {
    const found = jsonStringField(item);
    if (found === null || found === "") throw new Error(`${label} must be a non-empty string array`);
    strings.push(found);
  }
  if (new Set(strings).size !== strings.length) throw new Error(`${label} contains a duplicate`);
  return strings;
}

function repositoryPath(path: string, label: string): void {
  const file = path.split("#", 1)[0] ?? "";
  if (
    file === "" ||
    file.startsWith("/") ||
    file.includes("\\") ||
    file.split("/").some((part) => part === "" || part === "." || part === "..")
  ) {
    throw new Error(`${label} contains unsafe path ${path}`);
  }
}

function ownedPath(path: string): void {
  repositoryPath(path, "owned.paths");
  if (path === "**" || path === "*" || path === "*/**") {
    throw new Error(`owned path is overbroad: ${path}`);
  }
  const withoutSuffix = path.endsWith("/**") ? path.slice(0, -3) : path;
  if (
    withoutSuffix.includes("*") ||
    withoutSuffix.includes("?") ||
    withoutSuffix.includes("[") ||
    (path.includes("*") && !path.endsWith("/**"))
  ) {
    throw new Error(`owned path has unsupported glob: ${path}`);
  }
}

export interface InvasivePath {
  readonly path: string;
  readonly anchor: string;
}

export function splitInvasivePath(value: string): InvasivePath {
  const split = value.lastIndexOf("#");
  if (split <= 0 || split === value.length - 1) {
    throw new Error(`invasive path must contain an exact #anchor: ${value}`);
  }
  const path = value.slice(0, split);
  const anchor = value.slice(split + 1);
  repositoryPath(path, "invasive.paths");
  const control = [...anchor].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
  if (path.includes("*") || path.includes("?") || path.includes("[") || anchor.includes("#") || control) {
    throw new Error(`invasive path is not exact: ${value}`);
  }
  return { path, anchor };
}

function verificationPaths(value: JsonValue | undefined, label: string): string[] {
  const paths = textList(value, label);
  for (const path of paths) {
    repositoryPath(path, label);
    if (path.includes("*") || path.includes("?") || path.includes("#") || path.includes("[")) {
      throw new Error(`${label} must use exact paths`);
    }
  }
  return paths;
}

export function parseForkManifest(source: string): ForkManifest {
  let parsed: JsonValue;
  try {
    // SAFETY: Bun's TOML parser returns recursively structured primitives. The manifest accepts only
    // the JSON-shaped subset and narrows every table, scalar, and list before it becomes domain data.
    parsed = Bun.TOML.parse(source) as JsonValue;
  } catch {
    throw new Error("FORK.toml is not valid TOML");
  }
  const root = table(parsed, "FORK.toml");
  exactKeys(root, ["schema_version", "upstream", "owned", "invasive"], "FORK.toml");
  if (root.schema_version !== 2) throw new Error("FORK.toml schema_version must be 2");

  const upstream = table(root.upstream, "upstream");
  exactKeys(upstream, ["url", "tag", "tag_object", "commit"], "upstream");
  const normalizedUpstream: ForkUpstream = {
    url: text(upstream.url, "upstream.url"),
    tag: text(upstream.tag, "upstream.tag"),
    tag_object: text(upstream.tag_object, "upstream.tag_object"),
    commit: text(upstream.commit, "upstream.commit"),
  };
  if (!/^https:\/\/[A-Za-z0-9./_-]+\.git$/.test(normalizedUpstream.url)) {
    throw new Error("upstream.url must be an HTTPS Git URL");
  }
  if (!TAG_PATTERN.test(normalizedUpstream.tag)) {
    throw new Error("upstream.tag is malformed");
  }
  for (const key of ["tag_object", "commit"] as const) {
    if (!/^[0-9a-f]{40}$/.test(normalizedUpstream[key])) {
      throw new Error(`upstream.${key} is malformed`);
    }
  }

  if (!Array.isArray(root.owned) || !Array.isArray(root.invasive)) {
    throw new Error("FORK.toml requires owned and invasive entries");
  }
  const ids = new Set<string>();
  const declared = new Set<string>();
  const owned = root.owned.map((raw, index): ForkOwnedEntry => {
    const label = `owned[${index}]`;
    const value = table(raw, label);
    exactKeys(value, ["id", "intent", "paths", "contracts", "verify"], label);
    const entry = {
      id: text(value.id, `${label}.id`),
      intent: text(value.intent, `${label}.intent`),
      paths: textList(value.paths, `${label}.paths`),
      contracts: textList(value.contracts, `${label}.contracts`),
      verify: verificationPaths(value.verify, `${label}.verify`),
    };
    if (ids.has(entry.id)) throw new Error(`duplicate fork entry id ${entry.id}`);
    ids.add(entry.id);
    for (const path of entry.paths) {
      ownedPath(path);
      if (declared.has(path)) throw new Error(`duplicate fork path ${path}`);
      declared.add(path);
    }
    return entry;
  });
  const invasive = root.invasive.map((raw, index): ForkInvasiveEntry => {
    const label = `invasive[${index}]`;
    const value = table(raw, label);
    exactKeys(value, ["id", "intent", "strategy", "review", "reviewed", "paths", "verify", "reason"], label);
    const strategyValue = text(value.strategy, `${label}.strategy`);
    if (strategyValue !== "keep" && strategyValue !== "adapt" && strategyValue !== "drop") {
      throw new Error(`${label}.strategy is invalid`);
    }
    if (text(value.review, `${label}.review`) !== "every-upstream-sync") {
      throw new Error(`${label}.review must be every-upstream-sync`);
    }
    const reviewed = text(value.reviewed, `${label}.reviewed`);
    if (!TAG_PATTERN.test(reviewed)) throw new Error(`${label}.reviewed is malformed`);
    const entry: ForkInvasiveEntry = {
      id: text(value.id, `${label}.id`),
      intent: text(value.intent, `${label}.intent`),
      strategy: strategyValue,
      review: "every-upstream-sync",
      reviewed,
      paths: textList(value.paths, `${label}.paths`),
      verify: verificationPaths(value.verify, `${label}.verify`),
      reason: text(value.reason, `${label}.reason`),
    };
    if (ids.has(entry.id)) throw new Error(`duplicate fork entry id ${entry.id}`);
    ids.add(entry.id);
    for (const declaredPath of entry.paths) {
      splitInvasivePath(declaredPath);
      if (declared.has(declaredPath)) throw new Error(`duplicate fork path ${declaredPath}`);
      declared.add(declaredPath);
    }
    return entry;
  });

  if (owned.length === 0 || invasive.length === 0) {
    throw new Error("FORK.toml requires owned and invasive entries");
  }
  return { schema_version: 2, upstream: normalizedUpstream, owned, invasive };
}

export async function loadForkManifest(path: string | URL = new URL("../FORK.toml", import.meta.url)) {
  return parseForkManifest(await Bun.file(path).text());
}
