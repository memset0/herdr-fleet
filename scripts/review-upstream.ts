import { resolve } from "node:path";

import { loadForkManifest, type ForkManifest } from "./fork-manifest.ts";

export type ForkReviewDecision = "keep" | "adapt" | "replace" | "drop";
export type ForkTargetChange = "added" | "modified" | "deleted";

export interface ForkReviewDecisionRecord {
  decision: ForkReviewDecision;
  verification: string[];
  reason: string;
}

export interface ForkReviewDecisions {
  target: string;
  decisions: Record<string, ForkReviewDecisionRecord>;
}

export interface ForkReviewEntry {
  id: string;
  targetTouched: boolean;
  paths: string[];
  targetChanges: { path: string; status: ForkTargetChange }[];
  decision: ForkReviewDecision | null;
  verification: string[];
  reason: string | null;
  complete: boolean;
}

export interface ForkUpstreamReview {
  baseline: string;
  target: string;
  entries: ForkReviewEntry[];
  ownedCollisions: { id: string; path: string }[];
  errors: string[];
}

const DECISIONS = new Set<ForkReviewDecision>(["keep", "adapt", "replace", "drop"]);

function invasiveFile(value: string): string {
  return value.slice(0, value.lastIndexOf("#"));
}

function ownedMatches(pattern: string, path: string): boolean {
  return pattern.endsWith("/**") ? path.startsWith(pattern.slice(0, -2)) : path === pattern;
}

export function buildUpstreamReview(
  manifest: ForkManifest,
  target: string,
  targetChangedPaths: ReadonlyMap<string, ForkTargetChange>,
  targetFiles: ReadonlySet<string>,
  decisions?: ForkReviewDecisions,
): ForkUpstreamReview {
  const errors: string[] = [];
  if (decisions && decisions.target !== target) errors.push("review decisions target does not match selected target");
  const knownIds = new Set(manifest.invasive.map((entry) => entry.id));
  for (const id of Object.keys(decisions?.decisions ?? {})) {
    if (!knownIds.has(id)) errors.push(`review decisions contain unknown invasive id ${id}`);
  }

  const entries = manifest.invasive.map((entry): ForkReviewEntry => {
    const paths = entry.paths.map(invasiveFile);
    const targetChanges = paths.flatMap((path) => {
      const status = targetChangedPaths.get(path);
      return status ? [{ path, status }] : [];
    });
    const record = decisions?.decisions[entry.id];
    const decision = record?.decision ?? null;
    const verification = Array.isArray(record?.verification) ? record.verification : [];
    const reason = typeof record?.reason === "string" && record.reason.trim() ? record.reason.trim() : null;
    const complete = Boolean(decision && DECISIONS.has(decision) && verification.length > 0 && reason);
    if (record && !DECISIONS.has(record.decision)) errors.push(`invasive entry ${entry.id} has invalid decision`);
    if (record && !complete) errors.push(`invasive entry ${entry.id} has an incomplete decision`);
    return {
      id: entry.id,
      targetTouched: targetChanges.length > 0,
      paths,
      targetChanges,
      decision,
      verification,
      reason,
      complete,
    };
  });
  for (const entry of entries) {
    if (!entry.complete) errors.push(`invasive entry ${entry.id} is unreviewed`);
  }

  const ownedCollisions: { id: string; path: string }[] = [];
  for (const entry of manifest.owned) {
    for (const path of targetFiles) {
      if (entry.paths.some((pattern) => ownedMatches(pattern, path))) {
        ownedCollisions.push({ id: entry.id, path });
      }
    }
  }
  if (ownedCollisions.length > 0) {
    errors.push(`selected target occupies ${ownedCollisions.length} downstream-owned path(s)`);
  }
  return { baseline: manifest.upstream.commit, target, entries, ownedCollisions, errors };
}

function git(root: string, args: string[]): string {
  const result = Bun.spawnSync(["git", ...args], { cwd: root, stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) throw new Error(result.stderr.toString().trim() || `git ${args[0]} failed`);
  return result.stdout.toString();
}

function changedPaths(root: string, baseline: string, target: string): Map<string, ForkTargetChange> {
  const paths = new Map<string, ForkTargetChange>();
  for (const line of git(root, ["diff", "--name-status", "--find-renames", baseline, target, "--"])
    .trim()
    .split("\n")) {
    if (!line) continue;
    const fields = line.split("\t");
    const status = fields[0] ?? "";
    if (status.startsWith("R")) {
      if (fields[1]) paths.set(fields[1], "deleted");
      if (fields[2]) paths.set(fields[2], "added");
    } else if (fields[1]) {
      paths.set(
        fields[1],
        status === "A" ? "added" : status === "D" ? "deleted" : "modified",
      );
    }
  }
  return paths;
}

async function loadDecisions(path: string | null): Promise<ForkReviewDecisions | undefined> {
  if (!path) return undefined;
  const value: unknown = await Bun.file(path).json();
  if (!value || typeof value !== "object") throw new Error("review decisions must be an object");
  const record = value as Record<string, unknown>;
  if (typeof record.target !== "string" || !record.decisions || typeof record.decisions !== "object") {
    throw new Error("review decisions require target and decisions");
  }
  return value as ForkReviewDecisions;
}

function argument(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? (process.argv[index + 1] ?? null) : null;
}

if (import.meta.main) {
  const root = resolve(import.meta.dir, "..");
  const target = argument("--target");
  if (!target) throw new Error("usage: review-upstream.ts --target <commit> [--decisions <json>] [--require-complete]");
  const manifest = await loadForkManifest(resolve(root, "FORK.toml"));
  const resolvedTarget = git(root, ["rev-parse", `${target}^{commit}`]).trim();
  const decisions = await loadDecisions(argument("--decisions"));
  const targetFiles = new Set(
    git(root, ["ls-tree", "-r", "--name-only", resolvedTarget])
      .trim()
      .split("\n")
      .filter(Boolean),
  );
  const review = buildUpstreamReview(
    manifest,
    resolvedTarget,
    changedPaths(root, manifest.upstream.commit, resolvedTarget),
    targetFiles,
    decisions,
  );
  if (process.argv.includes("--json")) console.log(JSON.stringify(review, null, 2));
  else {
    for (const entry of review.entries) {
      console.log(
        `${entry.complete ? "reviewed" : "unreviewed"}\t${entry.targetChanges.map((change) => change.status).join(",") || "unchanged"}\t${entry.id}\t${entry.decision ?? "-"}`,
      );
    }
    for (const collision of review.ownedCollisions) {
      console.log(`owned-collision\t${collision.id}\t${collision.path}`);
    }
  }
  if (process.argv.includes("--require-complete") && review.errors.length > 0) {
    for (const error of review.errors) console.error(`upstream review: ${error}`);
    process.exit(1);
  }
}
