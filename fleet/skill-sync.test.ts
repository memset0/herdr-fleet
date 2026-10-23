import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { skillSyncEnabled } from "../cli/skill-sync-result.ts";
import { FLEET_PLUGIN_ID, fleetSkillSyncEnabled, isFleetCheckout, type ReadText } from "./skill-sync.ts";

const REPO = fileURLToPath(new URL("..", import.meta.url));

/** A reader over one fake checkout at `/fake`, whose manifest says `manifest` (or none). */
function checkout(manifest: string | null): ReadText {
  return (path) => {
    if (path === "/fake/herdr-plugin.toml" && manifest !== null) return manifest;
    throw Object.assign(new Error(`ENOENT: ${path}`), { code: "ENOENT" });
  };
}

const FLEET = checkout(`id = "${FLEET_PLUGIN_ID}"\nname = "Herdr Fleet"\nversion = "3.0.0"\n`);
const COLLIE = checkout(`id = "herdr.collie"\nname = "Collie"\nversion = "1.23.3"\n`);
const NONE = checkout(null);

describe("fleet-plugin-runtime: the update writes no agent skill on its own", () => {
  test("this repository is a Herdr Fleet checkout", () => {
    expect(isFleetCheckout(REPO)).toBe(true);
  });

  test("in a Fleet checkout the sync is off unless an on-word turns it on", () => {
    for (const raw of [undefined, "", "  ", "off", "0", "false", "no", "maybe"]) {
      expect(fleetSkillSyncEnabled("/fake", raw, skillSyncEnabled, FLEET)).toBe(false);
    }
    for (const raw of ["on", "1", "true", "yes", " ON "]) {
      expect(fleetSkillSyncEnabled("/fake", raw, skillSyncEnabled, FLEET)).toBe(true);
    }
  });

  test("anywhere else the answer is upstream's, unchanged", () => {
    for (const read of [COLLIE, NONE]) {
      for (const raw of [undefined, "", "off", "0", "on", "maybe"]) {
        expect(fleetSkillSyncEnabled("/fake", raw, skillSyncEnabled, read)).toBe(skillSyncEnabled(raw));
      }
    }
    // Upstream's default is on, which is exactly what Fleet turns off.
    expect(skillSyncEnabled(undefined)).toBe(true);
  });

  test("a manifest that only mentions the id elsewhere is not Fleet's", () => {
    const quoted = checkout(`id = "herdr.collie"\ndescription = "not ${FLEET_PLUGIN_ID}"\n`);
    expect(isFleetCheckout("/fake", quoted)).toBe(false);
  });

  test("the updater asks the Fleet decision, with its checkout root, before it would sync", () => {
    const source = readFileSync(new URL("../cli/update.ts", import.meta.url), "utf8");
    const body = source.slice(source.indexOf("function syncSkill("));
    const gate = body.indexOf("fleetSkillSyncEnabled(deps.ctx.root, deps.ctx.env.COLLIE_SKILL_SYNC, skillSyncEnabled)");
    expect(gate).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(body.indexOf('["skill", "sync", "--json"]'));
    // The gate is the one place the variable is read, so no path reaches the sync around it.
    expect(source.match(/env\.COLLIE_SKILL_SYNC\b/g)?.length).toBe(1);
  });
});
