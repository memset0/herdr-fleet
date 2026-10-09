import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// The Fleet navigation shell is mounted only by a bundle built with VITE_HERDR_FLEET=1
// (web/src/lib/fleet-build.ts). A Fleet bundle is built through exactly two routes, and a route that
// lost the statement would ship a lead without its rails, so both are pinned here.
const root = resolve(import.meta.dir, "..");

describe("every Fleet build states that it is one", () => {
  test("the plugin's build script exports the flag before it builds", () => {
    const script = readFileSync(resolve(root, "scripts/herdr-fleet.sh"), "utf8");
    const exported = script.indexOf("\nexport VITE_HERDR_FLEET=1\n");
    expect(exported).toBeGreaterThan(-1);
    // It must be in force before the first build the script can start.
    expect(exported).toBeLessThan(script.indexOf("collie-ctl.sh"));
  });

  test("the root build script, which the deployment builds with, sets it", () => {
    const manifest = readFileSync(resolve(root, "package.json"), "utf8");
    expect(manifest).toContain('"build": "VITE_HERDR_FLEET=1 bun run cli/main.ts build"');
  });

  test("the browser reads the same name", () => {
    const gate = readFileSync(resolve(root, "web/src/lib/fleet-build.ts"), "utf8");
    expect(gate).toContain('import.meta.env.VITE_HERDR_FLEET === "1"');
  });
});
