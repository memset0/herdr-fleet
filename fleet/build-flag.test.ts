import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// The Fleet navigation shell is mounted only by a bundle built with VITE_HERDR_FLEET=1
// (web/src/lib/fleet-build.ts). Every production bundle — `collie build`, which Herdr's build step and
// the lead's deployment both run, and `bun run build:web` — goes through web/package.json's `build`
// script, so that one script states it. Upstream's browser tier calls `vite build` itself and does not.
const root = resolve(import.meta.dir, "..");

describe("every Fleet build states that it is one", () => {
  test("the web build script sets the flag", () => {
    const manifest = readFileSync(resolve(root, "web/package.json"), "utf8");
    expect(manifest).toContain('"build": "VITE_HERDR_FLEET=1 vite build"');
  });

  test("collie build produces the bundle through that script", () => {
    const build = readFileSync(resolve(root, "cli/build.ts"), "utf8");
    expect(build).toContain('["run", "build", "--", "--outDir", "dist-staging", "--emptyOutDir"]');
  });

  test("the browser reads the same name", () => {
    const gate = readFileSync(resolve(root, "web/src/lib/fleet-build.ts"), "utf8");
    expect(gate).toContain('import.meta.env.VITE_HERDR_FLEET === "1"');
  });
});
