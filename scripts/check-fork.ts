import { resolve } from "node:path";

import {
  loadForkManifest,
  splitInvasivePath,
  type ForkManifest,
  type ForkOwnedEntry,
} from "./fork-manifest.ts";

export interface ForkChange {
  status: "added" | "modified" | "deleted";
  path: string;
}

export interface ForkCheckInput {
  changes: readonly ForkChange[];
  baselineFiles: ReadonlySet<string>;
  currentFiles: ReadonlyMap<string, string>;
}

export interface ForkCheckResult {
  errors: string[];
  owned: Map<string, string>;
  invasive: Map<string, string[]>;
}

function ownedMatches(entry: ForkOwnedEntry, path: string): boolean {
  return entry.paths.some((pattern) =>
    pattern.endsWith("/**")
      ? path.startsWith(pattern.slice(0, -2))
      : path === pattern,
  );
}

export function checkForkClassification(
  manifest: ForkManifest,
  input: ForkCheckInput,
): ForkCheckResult {
  const errors: string[] = [];
  const owned = new Map<string, string>();
  const invasive = new Map<string, string[]>();
  const invasiveByPath = new Map<string, string[]>();
  for (const entry of manifest.invasive) {
    for (const declared of entry.paths) {
      const { path } = splitInvasivePath(declared);
      const entries = invasiveByPath.get(path) ?? [];
      entries.push(entry.id);
      invasiveByPath.set(path, entries);
    }
  }

  for (const change of input.changes) {
    const entries = invasiveByPath.get(change.path) ?? [];
    if (entries.length > 0) {
      invasive.set(change.path, entries);
      continue;
    }
    const existedUpstream = input.baselineFiles.has(change.path);
    if (!existedUpstream && change.status !== "deleted") {
      const matches = manifest.owned.filter((entry) => ownedMatches(entry, change.path));
      if (matches.length !== 1) {
        errors.push(
          matches.length === 0
            ? `unclassified owned path ${change.path}`
            : `owned path ${change.path} matches several entries: ${matches.map((entry) => entry.id).join(", ")}`,
        );
      } else {
        owned.set(change.path, matches[0]!.id);
      }
      continue;
    }
    errors.push(`unclassified invasive path ${change.path}`);
  }

  for (const entry of manifest.owned) {
    for (const path of input.baselineFiles) {
      if (ownedMatches(entry, path)) {
        errors.push(`owned entry ${entry.id} collides with upstream path ${path}`);
        break;
      }
    }
    for (const verify of entry.verify) {
      if (!input.currentFiles.has(verify)) errors.push(`owned entry ${entry.id} has missing verification ${verify}`);
    }
  }
  for (const entry of manifest.invasive) {
    for (const verify of entry.verify) {
      if (!input.currentFiles.has(verify)) errors.push(`invasive entry ${entry.id} has missing verification ${verify}`);
    }
    for (const declared of entry.paths) {
      const { path, anchor } = splitInvasivePath(declared);
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

export function checkFleetImportBoundary(files: ReadonlyMap<string, string>): string[] {
  const errors: string[] = [];
  const importPattern = /(?:from\s+|import\s*\()(["'])([^"']+)\1/g;
  for (const [path, source] of files) {
    if (!/\.[cm]?[jt]sx?$/.test(path) || path.endsWith(".test.ts") || path.endsWith(".test.tsx")) continue;
    for (const match of source.matchAll(importPattern)) {
      const specifier = match[2]!;
      if (
        !path.startsWith("gateway/fleet-ui/") &&
        specifier.includes("gateway/fleet-ui/") &&
        !/gateway\/fleet-ui\/index(?:\.ts)?$/.test(specifier)
      ) {
        errors.push(`${path} deep-imports Gateway Fleet through ${specifier}`);
      }
      if (
        !path.startsWith("shared/fleet/") &&
        specifier.includes("shared/fleet/") &&
        !/shared\/fleet\/index(?:\.ts)?$/.test(specifier)
      ) {
        errors.push(`${path} deep-imports shared Fleet through ${specifier}`);
      }
      if (
        !path.startsWith("web/src/downstream/fleet/") &&
        specifier.includes("downstream/fleet/") &&
        !/downstream\/fleet\/index(?:\.ts)?$/.test(specifier)
      ) {
        errors.push(`${path} deep-imports Collie Fleet through ${specifier}`);
      }
    }
  }
  return errors;
}

function git(root: string, args: string[]): string {
  const result = Bun.spawnSync(["git", ...args], { cwd: root, stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) throw new Error(result.stderr.toString().trim() || `git ${args[0]} failed`);
  return result.stdout.toString();
}

function parseChanges(value: string): ForkChange[] {
  const changes: ForkChange[] = [];
  for (const line of value.trim().split("\n")) {
    if (!line) continue;
    const [status, first, second] = line.split("\t");
    if (!status || !first) throw new Error(`unexpected git diff row: ${line}`);
    if (status.startsWith("R")) {
      changes.push({ status: "deleted", path: first });
      if (!second) throw new Error(`rename row has no destination: ${line}`);
      changes.push({ status: "added", path: second });
    } else {
      changes.push({
        status: status === "A" ? "added" : status === "D" ? "deleted" : "modified",
        path: first,
      });
    }
  }
  return changes;
}

async function repositoryInput(root: string, manifest: ForkManifest): Promise<ForkCheckInput> {
  const baselineFiles = new Set(
    git(root, ["ls-tree", "-r", "--name-only", manifest.upstream.commit])
      .trim()
      .split("\n")
      .filter(Boolean),
  );
  const trackedChanges = parseChanges(
    git(root, ["diff", "--name-status", "--find-renames", manifest.upstream.commit, "--"]),
  );
  const untracked = git(root, ["ls-files", "--others", "--exclude-standard"])
    .trim()
    .split("\n")
    .filter(Boolean);
  const changedPaths = new Set(trackedChanges.map((change) => change.path));
  for (const path of untracked) {
    if (!changedPaths.has(path)) trackedChanges.push({ status: "added", path });
  }
  const currentPaths = git(root, ["ls-files", "--cached", "--others", "--exclude-standard"])
    .trim()
    .split("\n")
    .filter(Boolean);
  const deleted = new Set(
    git(root, ["ls-files", "--deleted"])
      .trim()
      .split("\n")
      .filter(Boolean),
  );
  const currentFiles = new Map<string, string>();
  for (const path of currentPaths) {
    if (deleted.has(path)) continue;
    const file = Bun.file(resolve(root, path));
    if (await file.exists()) currentFiles.set(path, await file.text());
  }
  return { changes: trackedChanges, baselineFiles, currentFiles };
}

export function checkForkDocumentation(
  manifest: ForkManifest,
  files: ReadonlyMap<string, string>,
): string[] {
  const errors: string[] = [];
  const upstream = files.get("UPSTREAM.md") ?? "";
  const guidance = files.get("CLAUDE.md") ?? "";
  if (!upstream.includes(manifest.upstream.tag) || !upstream.includes(manifest.upstream.commit)) {
    errors.push("UPSTREAM.md does not agree with FORK.toml upstream identity");
  }
  for (const required of ["FORK.toml", "scripts/check-fork.ts", "scripts/review-upstream.ts"]) {
    if (!guidance.includes(required)) errors.push(`CLAUDE.md does not name ${required}`);
  }
  const serialized = JSON.stringify(manifest).toLowerCase();
  for (const forbidden of ["/root/", "/home/", "vultr", "nvl72", "mukai", "mbp18", "mem.conf"]) {
    if (serialized.includes(forbidden)) errors.push(`FORK.toml contains private parent value ${forbidden}`);
  }
  return errors;
}

export async function checkForkRepository(root: string, manifestPath = resolve(root, "FORK.toml")): Promise<ForkCheckResult> {
  const manifest = await loadForkManifest(manifestPath);
  const input = await repositoryInput(root, manifest);
  const result = checkForkClassification(manifest, input);
  result.errors.push(...checkFleetImportBoundary(input.currentFiles));
  result.errors.push(...checkForkDocumentation(manifest, input.currentFiles));
  return result;
}

if (import.meta.main) {
  const root = resolve(import.meta.dir, "..");
  const result = await checkForkRepository(root);
  if (result.errors.length > 0) {
    for (const error of result.errors) console.error(`fork boundary: ${error}`);
    process.exit(1);
  }
  console.log(`fork boundary: ${result.owned.size} owned paths, ${result.invasive.size} invasive paths`);
}
