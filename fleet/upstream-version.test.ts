import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { loadForkManifest } from "../scripts/fork-manifest.ts";
import { parseUpstreamTag, upstreamVersion } from "./upstream-version.ts";

const MANIFEST = readFileSync(new URL("../FORK.toml", import.meta.url), "utf8");

function source(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), "utf8");
}

describe("the Collie removal clock", () => {
  test("reads the release FORK.toml records, not this product's version line", async () => {
    const recorded = (await loadForkManifest()).upstream.tag;
    expect(`v${upstreamVersion().text}`).toBe(recorded);

    // The product line began at 3.0.0 on Collie 1.x; the clock must follow the tag, whatever that is.
    const product = /"version": *"([^"]+)"/.exec(source("../package.json"))?.[1];
    expect(product).toBeDefined();
    expect(upstreamVersion().text).not.toBe(product);
  });

  test("follows [upstream].tag when an adoption moves it, and nothing else", () => {
    const dir = mkdtempSync(join(tmpdir(), "upstream-version-"));
    try {
      const moved = MANIFEST.replace(/^tag = "v[^"]+"$/m, 'tag = "v2.10.3"');
      expect(moved).not.toBe(MANIFEST);
      const path = join(dir, "FORK.toml");
      writeFileSync(path, moved);
      expect(upstreamVersion(pathToFileURL(path))).toEqual({
        major: 2,
        minor: 10,
        patch: 3,
        text: "2.10.3",
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("refuses a tag it cannot read as a release, rather than reading it as zero", () => {
    for (const tag of ["1.8.2", "v1.8", "v1.8.2-rc.1", "v01.8.2", "v1.8.2 ", ""]) {
      expect(() => parseUpstreamTag(tag)).toThrow(/strict vX\.Y\.Z/);
    }
    expect(parseUpstreamTag("v1.8.2")).toEqual({ major: 1, minor: 8, patch: 2, text: "1.8.2" });
  });

  // The port itself (FORK.toml `upstream-removal-clock`): upstream's one remaining clock reads this
  // module, not the root package.json. `bridge/removal-schedule.test.ts` became a tombstone with no
  // clock in Collie 1.9.0 and is upstream's file again.
  test("the upstream removal clock reads it", () => {
    const text = source("../cli/program.test.ts");
    expect(text).toContain("upstreamVersion()");
    expect(text).not.toContain('"../package.json"');
    expect(source("../bridge/removal-schedule.test.ts")).not.toContain("upstreamVersion");
  });
});
