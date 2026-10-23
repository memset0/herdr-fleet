// Herdr Fleet writes no agent skill on its own (fleet-plugin-runtime).
//
// Collie 1.23 (ADR 0111) runs `collie skill sync` after every successful update, rollback and
// release-line switch: the new build writes its walky talky skill into every agent harness it finds on
// the machine (Claude Code, Codex, opencode, pi, Gemini CLI). The owner decided Fleet does not: in a
// Herdr Fleet checkout the sync runs only when the operator turns `COLLIE_SKILL_SYNC` on, and upstream's
// one note says when the skill is behind. `collie skill install` and `collie skill sync` by hand are
// the operator's own acts and stay upstream's.
//
// The checkout, not the environment, says this is Herdr Fleet: the phone's Update and Roll back start
// `collie update` in a `systemd-run --user` transient unit with a bare environment
// (bridge/update-action.ts), so a variable set on the Collie child would not reach the updater.

import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Herdr Fleet's plugin id, as `herdr-plugin.toml` names it. */
export const FLEET_PLUGIN_ID = "memset0.herdr-fleet";

/** The words that turn a switch on, as upstream's `envBool` reads them (bridge/config.ts). */
const ON_WORDS: ReadonlySet<string> = new Set(["on", "1", "true", "yes"]);

const MANIFEST_ID = new RegExp(`^id\\s*=\\s*"${FLEET_PLUGIN_ID.replaceAll(".", "\\.")}"\\s*$`, "m");

/** Reads one file as text, or throws. A seam for the suite. */
export type ReadText = (path: string) => string;

const readDisk: ReadText = (path) => readFileSync(path, "utf8");

/** Whether `root` is a Herdr Fleet checkout: its plugin manifest names Fleet's id. A missing or unreadable manifest is not. */
export function isFleetCheckout(root: string, read: ReadText = readDisk): boolean {
  let text: string;
  try {
    text = read(join(root, "herdr-plugin.toml"));
  } catch {
    return false;
  }
  return MANIFEST_ID.test(text);
}

/**
 * Whether the update's skill sync runs. In a Herdr Fleet checkout only an explicit on-word turns it
 * on; anywhere else the answer is upstream's own (`upstream`, `skillSyncEnabled` in
 * cli/skill-sync-result.ts), unchanged.
 */
export function fleetSkillSyncEnabled(
  root: string,
  raw: string | undefined,
  upstream: (raw: string | undefined) => boolean,
  read: ReadText = readDisk,
): boolean {
  if (!isFleetCheckout(root, read)) return upstream(raw);
  return ON_WORDS.has((raw ?? "").trim().toLowerCase());
}
