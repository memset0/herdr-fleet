import { describe, expect, test } from "bun:test";

import type { ForkManifest } from "./fork-manifest.ts";
import {
  checkFleetImportBoundary,
  checkForkClassification,
  checkForkDocumentation,
} from "./check-fork.ts";

function manifest(): ForkManifest {
  return {
    schema_version: 1,
    upstream: {
      url: "https://github.com/example/collie.git",
      tag: "v0.34.0",
      commit: "0c647372d89d50ec62dfe8b569e9109a830660e5",
    },
    owned: [
      {
        id: "gateway",
        intent: "Synthetic Gateway.",
        paths: ["gateway/**"],
        contracts: ["snapshot"],
        verify: ["gateway/fleet.test.ts"],
      },
    ],
    invasive: [
      {
        id: "app-port",
        intent: "Synthetic application port.",
        strategy: "keep",
        review: "every-upstream-sync",
        paths: ["web/src/App.tsx#App"],
        verify: ["web/src/App.test.tsx"],
        reason: "Application bootstrap belongs to the host.",
      },
      {
        id: "retired-script",
        intent: "Synthetic deletion.",
        strategy: "drop",
        review: "every-upstream-sync",
        paths: ["scripts/old.sh#deleted"],
        verify: ["scripts/check.test.ts"],
        reason: "The downstream lifecycle has one owner.",
      },
    ],
  };
}

function files(): Map<string, string> {
  return new Map([
    ["gateway/index.ts", "export {};"],
    ["gateway/fleet.test.ts", "test('fleet', () => {});"],
    ["web/src/App.tsx", "export function App() {}"],
    ["web/src/App.test.tsx", "test('app', () => {});"],
    ["scripts/check.test.ts", "test('check', () => {});"],
  ]);
}

describe("fork boundary classification", () => {
  test("classifies added owned paths and exact upstream edits", () => {
    const result = checkForkClassification(manifest(), {
      changes: [
        { status: "added", path: "gateway/index.ts" },
        { status: "modified", path: "web/src/App.tsx" },
        { status: "deleted", path: "scripts/old.sh" },
      ],
      baselineFiles: new Set(["web/src/App.tsx", "scripts/old.sh"]),
      currentFiles: files(),
    });
    expect(result.errors).toEqual([]);
    expect(result.owned.get("gateway/index.ts")).toBe("gateway");
    expect(result.invasive.get("web/src/App.tsx")).toEqual(["app-port"]);
  });

  test("rejects unclassified and colliding paths", () => {
    const result = checkForkClassification(manifest(), {
      changes: [
        { status: "added", path: "other/new.ts" },
        { status: "modified", path: "web/src/Other.tsx" },
      ],
      baselineFiles: new Set(["web/src/Other.tsx", "gateway/upstream.ts"]),
      currentFiles: files(),
    });
    expect(result.errors).toContain("unclassified owned path other/new.ts");
    expect(result.errors).toContain("unclassified invasive path web/src/Other.tsx");
    expect(result.errors).toContain("owned entry gateway collides with upstream path gateway/upstream.ts");
  });

  test("rejects stale anchors and verification paths", () => {
    const current = files();
    current.set("web/src/App.tsx", "export function SomethingElse() {}");
    current.delete("scripts/check.test.ts");
    const result = checkForkClassification(manifest(), {
      changes: [{ status: "modified", path: "web/src/App.tsx" }],
      baselineFiles: new Set(["web/src/App.tsx", "scripts/old.sh"]),
      currentFiles: current,
    });
    expect(result.errors).toContain("invasive anchor is stale: web/src/App.tsx#App");
    expect(result.errors).toContain("invasive entry retired-script has missing verification scripts/check.test.ts");
  });

  test("rejects a stale deletion marker", () => {
    const current = files();
    current.set("scripts/old.sh", "#!/bin/sh\n");
    const result = checkForkClassification(manifest(), {
      changes: [{ status: "modified", path: "scripts/old.sh" }],
      baselineFiles: new Set(["web/src/App.tsx", "scripts/old.sh"]),
      currentFiles: current,
    });
    expect(result.errors).toContain("deletion marker is stale: scripts/old.sh#deleted");
  });
});

describe("Fleet import boundary", () => {
  test("allows barrels and tests but rejects runtime deep imports", () => {
    expect(
      checkFleetImportBoundary(
        new Map([
          ["gateway/ui.ts", 'export { fleetPage } from "./fleet-ui/index.ts";'],
          ["web/src/App.tsx", 'import { thing } from "./downstream/fleet/private.ts";'],
          ["web/src/App.test.tsx", 'import { thing } from "./downstream/fleet/private.ts";'],
        ]),
      ),
    ).toEqual(["web/src/App.tsx deep-imports Collie Fleet through ./downstream/fleet/private.ts"]);
  });
});

describe("fork documentation boundary", () => {
  test("requires exact upstream agreement and executable workflow names", () => {
    const value = manifest();
    expect(
      checkForkDocumentation(
        value,
        new Map([
          ["UPSTREAM.md", `${value.upstream.tag} ${value.upstream.commit}`],
          ["CLAUDE.md", "FORK.toml scripts/check-fork.ts scripts/review-upstream.ts"],
        ]),
      ),
    ).toEqual([]);

    expect(checkForkDocumentation(value, new Map())).toEqual([
      "UPSTREAM.md does not agree with FORK.toml upstream identity",
      "CLAUDE.md does not name FORK.toml",
      "CLAUDE.md does not name scripts/check-fork.ts",
      "CLAUDE.md does not name scripts/review-upstream.ts",
    ]);
  });

  test("rejects private parent context anywhere in the manifest", () => {
    const value = manifest();
    value.owned[0]!.intent = "Synthetic /root/private parent path.";
    expect(checkForkDocumentation(value, new Map())).toContain(
      "FORK.toml contains private parent value /root/",
    );
  });
});
