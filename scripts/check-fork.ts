import { readdirSync } from "node:fs";
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
  /** `CHANGELOG.md` as the adopted upstream release wrote it. */
  readonly upstreamChangelog: string;
}

/** Collie's own history, under its own name. */
export const RETAINED_CHANGELOG = "COLLIE_CHANGELOG.md";

/**
 * Upstream rewrites and truncates its changelog, so retaining Collie's history and retaining its
 * file byte-for-byte stopped being the same thing. The adopted release's text stays a byte-exact
 * prefix; entries upstream has dropped are kept below this line, which tells a reader that what
 * follows is not what upstream currently publishes.
 */
export const CHANGELOG_SEAM =
  "<!-- Retained from an earlier adoption: upstream truncated its own changelog above this line. -->";

function checkRetainedChangelog(input: ForkCheckInput, errors: string[]): void {
  const retained = input.currentFiles.get(RETAINED_CHANGELOG);
  if (retained === undefined) {
    errors.push(`${RETAINED_CHANGELOG} is missing`);
    return;
  }
  if (!retained.startsWith(input.upstreamChangelog)) {
    errors.push(`${RETAINED_CHANGELOG} does not begin with the adopted release's changelog`);
    return;
  }
  const remainder = retained.slice(input.upstreamChangelog.length);
  if (remainder.trim() === "") return;
  const seam = remainder.split("\n").find((line) => line.trim() !== "");
  if (seam?.trim() !== CHANGELOG_SEAM) {
    errors.push(`${RETAINED_CHANGELOG} retains earlier entries without the seam marker`);
  }
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
  for (const entry of manifest.invasive) {
    if (entry.reviewed !== manifest.upstream.tag) {
      errors.push(`invasive entry ${entry.id} was last reviewed against ${entry.reviewed}, not ${manifest.upstream.tag}`);
    }
  }
  checkRetainedChangelog(input, errors);
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

export interface PreflightInput {
  /** Uncommitted or untracked paths; any at all refuses the adoption. */
  readonly dirty: readonly string[];
  readonly activeChanges: readonly string[];
  readonly allowActiveChanges: boolean;
  /** The tag object the target ref resolves to, or null when it is not an annotated tag. */
  readonly tagObject: string | null;
  readonly commit: string;
  readonly mergeBase: string;
  /** Paths the target release changes, measured from the adopted baseline. */
  readonly changedPaths: ReadonlySet<string>;
  readonly targetFiles: ReadonlySet<string>;
}

export interface PreflightEntry {
  readonly id: string;
  readonly paths: readonly string[];
}

export interface PreflightReport {
  readonly errors: string[];
  readonly disturbed: readonly PreflightEntry[];
  readonly undisturbed: readonly string[];
  readonly collisions: readonly PreflightEntry[];
  readonly activeChanges: readonly string[];
}

/**
 * Answers what a candidate upstream release would do to this fork, before a merge is opened. It
 * reports and refuses; every decision it surfaces is the reviewer's to make.
 */
export function planUpstreamAdoption(manifest: ForkManifest, input: PreflightInput): PreflightReport {
  const refuse = (message: string): PreflightReport => ({
    errors: [message],
    disturbed: [],
    undisturbed: [],
    collisions: [],
    activeChanges: input.activeChanges,
  });

  if (input.dirty.length > 0) {
    return refuse(`the working tree is not clean: commit or remove ${input.dirty.length} path(s) first`);
  }
  if (input.tagObject === null) {
    return refuse("the target is not an annotated tag, so the release it names cannot be pinned");
  }
  if (input.mergeBase !== manifest.upstream.commit) {
    return refuse(
      `the recorded baseline ${manifest.upstream.commit} is not the merge base of this tree and the target (${input.mergeBase})`,
    );
  }
  if (input.activeChanges.length > 0 && !input.allowActiveChanges) {
    return refuse(
      `${input.activeChanges.length} OpenSpec change(s) are active (${input.activeChanges.join(", ")}); proceed only with the operator's authorization`,
    );
  }

  const disturbed: PreflightEntry[] = [];
  const undisturbed: string[] = [];
  for (const entry of manifest.invasive) {
    const paths = entry.paths
      .map((declared) => splitInvasivePath(declared).path)
      .filter((path) => input.changedPaths.has(path));
    if (paths.length > 0) disturbed.push({ id: entry.id, paths });
    else undisturbed.push(entry.id);
  }

  const collisions: PreflightEntry[] = [];
  for (const entry of manifest.owned) {
    const paths = [...input.targetFiles].filter((path) => ownedMatches(entry, path)).toSorted();
    if (paths.length > 0) collisions.push({ id: entry.id, paths });
  }

  return { errors: [], disturbed, undisturbed, collisions, activeChanges: input.activeChanges };
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
  return {
    changes,
    baselineFiles,
    currentFiles,
    upstreamChangelog: git(root, ["show", `${manifest.upstream.commit}:CHANGELOG.md`]),
  };
}

export async function checkForkRepository(root: string): Promise<ForkCheckResult> {
  const manifest = await loadForkManifest(resolve(root, "FORK.toml"));
  return checkForkClassification(manifest, await repositoryInput(root, manifest));
}

function tryGit(root: string, args: readonly string[]): string | null {
  try {
    return git(root, args);
  } catch {
    return null;
  }
}

function lines(source: string): string[] {
  return source.trim().split("\n").filter(Boolean);
}

function activeChanges(root: string): string[] {
  try {
    return readdirSync(resolve(root, "openspec/changes"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== "archive")
      .map((entry) => entry.name)
      .toSorted();
  } catch {
    return [];
  }
}

export function preflightInput(root: string, ref: string, allowActiveChanges: boolean, manifest: ForkManifest): PreflightInput {
  const dirty = lines(git(root, ["status", "--porcelain", "--untracked-files=all"]));
  const tagObject = tryGit(root, ["cat-file", "-t", ref])?.trim() === "tag" ? tryGit(root, ["rev-parse", ref])?.trim() ?? null : null;
  const commit = tryGit(root, ["rev-parse", `${ref}^{commit}`])?.trim() ?? "";
  if (commit === "") throw new Error(`the target ref ${ref} does not resolve to a commit`);
  const mergeBase = tryGit(root, ["merge-base", "HEAD", commit])?.trim() ?? "";
  return {
    dirty,
    activeChanges: activeChanges(root),
    allowActiveChanges,
    tagObject,
    commit,
    mergeBase,
    changedPaths: new Set(
      tagObject === null || mergeBase !== manifest.upstream.commit
        ? []
        : lines(git(root, ["diff", "--name-only", manifest.upstream.commit, commit])),
    ),
    targetFiles: new Set(
      tagObject === null || mergeBase !== manifest.upstream.commit
        ? []
        : lines(git(root, ["ls-tree", "-r", "--name-only", commit])),
    ),
  };
}

export async function preflightUpstreamAdoption(
  root: string,
  ref: string,
  allowActiveChanges: boolean,
): Promise<{ report: PreflightReport; manifest: ForkManifest; input: PreflightInput }> {
  const manifest = await loadForkManifest(resolve(root, "FORK.toml"));
  const input = preflightInput(root, ref, allowActiveChanges, manifest);
  return { report: planUpstreamAdoption(manifest, input), manifest, input };
}

function usage(message: string): never {
  console.error(`fork boundary: ${message}`);
  console.error("usage: check-fork.ts [--target <ref> [--allow-active-changes]]");
  process.exit(2);
}

if (import.meta.main) {
  const root = resolve(import.meta.dir, "..");
  const argv = Bun.argv.slice(2);
  let target: string | null = null;
  let allowActiveChanges = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--target") {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) usage("--target needs a ref");
      target = value;
      index += 1;
    } else if (argument === "--allow-active-changes") {
      allowActiveChanges = true;
    } else {
      usage(`unknown argument ${argument}`);
    }
  }
  if (target === null) {
    if (allowActiveChanges) usage("--allow-active-changes only applies to --target");
    const result = await checkForkRepository(root);
    if (result.errors.length > 0) {
      for (const error of result.errors) console.error(`fork boundary: ${error}`);
      process.exitCode = 1;
    } else {
      console.log(`fork boundary: ${result.owned.size} owned paths, ${result.invasive.size} invasive paths`);
    }
  } else {
    const { report, manifest, input } = await preflightUpstreamAdoption(root, target, allowActiveChanges);
    if (report.errors.length > 0) {
      for (const error of report.errors) console.error(`upstream adoption: ${error}`);
      process.exitCode = 1;
    } else {
      console.log(`upstream adoption: ${manifest.upstream.tag} (${manifest.upstream.commit}) -> ${target} (${input.commit})`);
      console.log(`  tag object ${input.tagObject}`);
      console.log(`  ${report.disturbed.length} invasive entries disturbed by this release:`);
      for (const entry of report.disturbed) console.log(`    ${entry.id}: ${entry.paths.length} path(s)`);
      console.log(`  ${report.undisturbed.length} untouched, and reviewed all the same: ${report.undisturbed.join(", ")}`);
      if (report.collisions.length > 0) {
        console.log("  ESCALATE - the release now ships paths declared downstream-owned:");
        for (const entry of report.collisions) console.log(`    ${entry.id}: ${entry.paths.join(", ")}`);
      } else {
        console.log("  no owned path is occupied by this release");
      }
      const authorized = report.activeChanges.length === 0 ? "none" : `${report.activeChanges.join(", ")} (authorized)`;
      console.log(`  active OpenSpec changes: ${authorized}`);
    }
  }
}
