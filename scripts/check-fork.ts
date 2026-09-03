import { resolve } from "node:path";

import { loadForkManifest, splitInvasivePath, type ForkManifest, type ForkOwnedEntry } from "./fork-manifest.ts";

export interface ForkChange {
  readonly status: "added" | "modified" | "deleted";
  readonly path: string;
}

export interface ForkCheckInput {
  readonly changes: readonly ForkChange[];
  readonly baselineFiles: ReadonlySet<string>;
  readonly currentFiles: ReadonlyMap<string, string>;
}

export interface ForkCheckResult {
  readonly errors: string[];
  readonly owned: ReadonlyMap<string, string>;
  readonly invasive: ReadonlyMap<string, string>;
}

function ownedMatches(entry: ForkOwnedEntry, path: string): boolean {
  return entry.paths.some((pattern) =>
    pattern.endsWith("/**") ? path.startsWith(pattern.slice(0, -3) + "/") : path === pattern,
  );
}

export function checkForkClassification(manifest: ForkManifest, input: ForkCheckInput): ForkCheckResult {
  const errors: string[] = [];
  const owned = new Map<string, string>();
  const invasive = new Map<string, string>();
  const invasiveByPath = new Map<string, { id: string; anchor: string }>();
  for (const entry of manifest.invasive) {
    for (const declared of entry.paths) {
      const split = splitInvasivePath(declared);
      if (invasiveByPath.has(split.path)) errors.push(`invasive path ${split.path} is declared more than once`);
      invasiveByPath.set(split.path, { id: entry.id, anchor: split.anchor });
    }
  }

  const changed = new Set(input.changes.map((entry) => entry.path));
  for (const change of input.changes) {
    const existed = input.baselineFiles.has(change.path);
    if (existed || change.status === "deleted") {
      const declaration = invasiveByPath.get(change.path);
      if (declaration === undefined) errors.push(`unclassified invasive path ${change.path}`);
      else invasive.set(change.path, declaration.id);
      continue;
    }
    const matches = manifest.owned.filter((entry) => ownedMatches(entry, change.path));
    if (matches.length === 0) errors.push(`unclassified owned path ${change.path}`);
    else if (matches.length > 1) {
      errors.push(`owned path ${change.path} matches several entries: ${matches.map((entry) => entry.id).join(", ")}`);
    } else {
      owned.set(change.path, matches[0]!.id);
    }
  }

  for (const entry of manifest.owned) {
    for (const path of input.baselineFiles) {
      if (ownedMatches(entry, path)) {
        errors.push(`owned entry ${entry.id} collides with upstream path ${path}`);
        break;
      }
    }
    for (const path of entry.verify) {
      if (!input.currentFiles.has(path)) errors.push(`owned entry ${entry.id} has missing verification ${path}`);
    }
  }
  for (const entry of manifest.invasive) {
    for (const path of entry.verify) {
      if (!input.currentFiles.has(path)) errors.push(`invasive entry ${entry.id} has missing verification ${path}`);
    }
    for (const declared of entry.paths) {
      const { path, anchor } = splitInvasivePath(declared);
      if (!changed.has(path)) errors.push(`invasive declaration is stale: ${declared}`);
      const current = input.currentFiles.get(path);
      if (anchor === "deleted") {
        if (current !== undefined) errors.push(`deletion marker is stale: ${declared}`);
      } else if (current === undefined) {
        errors.push(`invasive anchor file is missing: ${declared}`);
      } else if (!current.includes(anchor)) {
        errors.push(`invasive anchor is stale: ${declared}`);
      }
    }
  }
  return { errors, owned, invasive };
}

function git(root: string, args: readonly string[]): string {
  const result = Bun.spawnSync(["git", ...args], { cwd: root, stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) {
    throw new Error(result.stderr.toString().trim() || `git ${args[0] ?? "command"} failed`);
  }
  return result.stdout.toString();
}

export function parseGitChanges(source: string): ForkChange[] {
  const changes: ForkChange[] = [];
  for (const line of source.trim().split("\n")) {
    if (line === "") continue;
    const [status, first, second] = line.split("\t");
    if (status === undefined || first === undefined) throw new Error(`unexpected git diff row: ${line}`);
    if (status.startsWith("R")) {
      changes.push({ status: "deleted", path: first });
      if (second === undefined) throw new Error(`rename row has no destination: ${line}`);
      changes.push({ status: "added", path: second });
      continue;
    }
    changes.push({
      status: status === "A" ? "added" : status === "D" ? "deleted" : "modified",
      path: first,
    });
  }
  return changes;
}

async function repositoryInput(root: string, manifest: ForkManifest): Promise<ForkCheckInput> {
  const baselineFiles = new Set(
    git(root, ["ls-tree", "-r", "--name-only", manifest.upstream.commit]).trim().split("\n").filter(Boolean),
  );
  const changes = parseGitChanges(
    git(root, ["diff", "--name-status", "--find-renames", manifest.upstream.commit, "--"]),
  );
  const already = new Set(changes.map((entry) => entry.path));
  const untracked = git(root, ["ls-files", "--others", "--exclude-standard"]).trim().split("\n").filter(Boolean);
  for (const path of untracked) {
    if (!already.has(path)) changes.push({ status: "added", path });
  }

  const currentPaths = git(root, ["ls-files", "--cached", "--others", "--exclude-standard"])
    .trim()
    .split("\n")
    .filter(Boolean);
  const deleted = new Set(git(root, ["ls-files", "--deleted"]).trim().split("\n").filter(Boolean));
  const currentFiles = new Map<string, string>();
  for (const path of currentPaths) {
    if (deleted.has(path)) continue;
    const file = Bun.file(resolve(root, path));
    if (await file.exists()) currentFiles.set(path, await file.text());
  }
  return { changes, baselineFiles, currentFiles };
}

export async function checkForkRepository(root: string): Promise<ForkCheckResult> {
  const manifest = await loadForkManifest(resolve(root, "FORK.toml"));
  return checkForkClassification(manifest, await repositoryInput(root, manifest));
}

if (import.meta.main) {
  const root = resolve(import.meta.dir, "..");
  const result = await checkForkRepository(root);
  if (result.errors.length > 0) {
    for (const error of result.errors) console.error(`fork boundary: ${error}`);
    process.exitCode = 1;
  } else {
    console.log(`fork boundary: ${result.owned.size} owned paths, ${result.invasive.size} invasive paths`);
  }
}
