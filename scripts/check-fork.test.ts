import { describe, expect, test } from "bun:test";

import {
  CHANGELOG_SEAM,
  checkForkClassification,
  parseGitChanges,
  planUpstreamAdoption,
  type PreflightInput,
} from "./check-fork.ts";
import { parseForkManifest } from "./fork-manifest.ts";

const source = `schema_version = 2
[upstream]
url = "https://github.com/example/collie.git"
tag = "v1.2.0"
tag_object = "0f98f28c9aaadd641c4bc5ac484190ee3ef7008c"
commit = "4618c90534d6f818ed6788b8db00e1582c5abfdc"
[[owned]]
id = "fleet"
intent = "Synthetic owned boundary."
paths = ["fleet/**"]
contracts = ["configuration"]
verify = ["fleet/config.test.ts"]
[[invasive]]
id = "host-port"
intent = "Synthetic host port."
strategy = "adapt"
review = "every-upstream-sync"
reviewed = "v1.2.0"
paths = ["package.json#fleet"]
verify = ["fleet/config.test.ts"]
reason = "The root package owns the test entrypoint."
`;

const upstreamChangelog = "# Changelog\n\n## [1.2.0]\n- upstream entry\n";

function withFiles(...extra: readonly (readonly [string, string])[]): Map<string, string> {
  return new Map([
    ["fleet/config.ts", "export {};"],
    ["fleet/config.test.ts", "test('config', () => {});"],
    ["package.json", '{"scripts":{"test":"bun test ./fleet"}}'],
    ["COLLIE_CHANGELOG.md", upstreamChangelog],
    ...extra,
  ]);
}

const files = withFiles();

describe("fork classification", () => {
  test("classifies exactly one owned root and an anchored upstream edit", () => {
    const result = checkForkClassification(parseForkManifest(source), {
      changes: [
        { status: "added", path: "fleet/config.ts" },
        { status: "added", path: "fleet/config.test.ts" },
        { status: "modified", path: "package.json" },
      ],
      baselineFiles: new Set(["package.json"]),
      currentFiles: files,
      upstreamChangelog,
    });
    expect(result.errors).toEqual([]);
    expect(result.owned.get("fleet/config.ts")).toBe("fleet");
    expect(result.invasive.get("package.json")).toBe("host-port");
  });

  test("rejects unclassified and overclaimed owned paths", () => {
    const result = checkForkClassification(parseForkManifest(source), {
      changes: [
        { status: "added", path: "other/new.ts" },
        { status: "modified", path: "bridge/server.ts" },
      ],
      baselineFiles: new Set(["bridge/server.ts", "fleet/upstream.ts"]),
      currentFiles: files,
      upstreamChangelog,
    });
    expect(result.errors).toContain("unclassified owned path other/new.ts");
    expect(result.errors).toContain("unclassified invasive path bridge/server.ts");
    expect(result.errors).toContain("owned entry fleet collides with upstream path fleet/upstream.ts");
  });

  test("refuses a port that was last reviewed against an older release", () => {
    const result = checkForkClassification(parseForkManifest(source.replace('reviewed = "v1.2.0"', 'reviewed = "v1.1.0"')), {
      changes: [{ status: "modified", path: "package.json" }],
      baselineFiles: new Set(["package.json"]),
      currentFiles: files,
      upstreamChangelog,
    });
    expect(result.errors).toContain("invasive entry host-port was last reviewed against v1.1.0, not v1.2.0");
  });

  test("retains Collie's history accumulatively behind one seam marker", () => {
    const retained = (body: string) =>
      checkForkClassification(parseForkManifest(source), {
        changes: [{ status: "modified", path: "package.json" }],
        baselineFiles: new Set(["package.json"]),
        currentFiles: withFiles(["COLLIE_CHANGELOG.md", body]),
        upstreamChangelog,
      }).errors;

    expect(retained(upstreamChangelog)).toEqual([]);
    expect(retained(`${upstreamChangelog}\n${CHANGELOG_SEAM}\n\n## [1.0.0]\n- dropped upstream\n`)).toEqual([]);
    expect(retained(`${upstreamChangelog}\n## [1.0.0]\n- dropped upstream\n`)).toContain(
      "COLLIE_CHANGELOG.md retains earlier entries without the seam marker",
    );
    expect(retained(upstreamChangelog.replace("upstream entry", "edited entry"))).toContain(
      "COLLIE_CHANGELOG.md does not begin with the adopted release's changelog",
    );
  });

  test("parses renames as one deletion and one addition", () => {
    expect(parseGitChanges("R100\told.ts\tnew.ts\n")).toEqual([
      { status: "deleted", path: "old.ts" },
      { status: "added", path: "new.ts" },
    ]);
  });
});

describe("upstream adoption preflight", () => {
  const baseline = "4618c90534d6f818ed6788b8db00e1582c5abfdc";
  const manifest = parseForkManifest(source);
  const plan = (overrides: Partial<PreflightInput> = {}) =>
    planUpstreamAdoption(manifest, {
      dirty: [],
      activeChanges: [],
      allowActiveChanges: false,
      tagObject: "a326aedc6a44572cea51432545ea5762acc42648",
      commit: "ba39c05c6350a52bcb0a88f118cd0680ff85a1c5",
      mergeBase: baseline,
      changedPaths: new Set(["package.json", "bridge/server.ts"]),
      targetFiles: new Set(["package.json", "bridge/server.ts"]),
      ...overrides,
    });

  test("reports the ports the release disturbs, and the ones it leaves alone", () => {
    const report = plan();
    expect(report.errors).toEqual([]);
    expect(report.disturbed).toEqual([{ id: "host-port", paths: ["package.json"] }]);
    expect(report.undisturbed).toEqual([]);
    expect(report.collisions).toEqual([]);
  });

  test("an untouched port is still listed for review", () => {
    expect(plan({ changedPaths: new Set(["bridge/server.ts"]) }).undisturbed).toEqual(["host-port"]);
  });

  test("escalates a downstream-owned path the release now ships", () => {
    const report = plan({ targetFiles: new Set(["package.json", "fleet/config.ts"]) });
    expect(report.collisions).toEqual([{ id: "fleet", paths: ["fleet/config.ts"] }]);
  });

  test("refuses a dirty tree before anything else", () => {
    expect(plan({ dirty: [" M FORK.toml"], mergeBase: "0".repeat(40) }).errors).toEqual([
      "the working tree is not clean: commit or remove 1 path(s) first",
    ]);
  });

  test("refuses a target that is not an annotated tag", () => {
    expect(plan({ tagObject: null }).errors[0]).toContain("not an annotated tag");
  });

  test("refuses a target whose merge base is not the recorded baseline", () => {
    expect(plan({ mergeBase: "0".repeat(40) }).errors[0]).toContain(`the recorded baseline ${baseline} is not the merge base`);
  });

  test("refuses an active change until the operator authorizes it, then proceeds", () => {
    expect(plan({ activeChanges: ["attach-the-browser"] }).errors[0]).toContain("proceed only with the operator's authorization");
    const authorized = plan({ activeChanges: ["attach-the-browser"], allowActiveChanges: true });
    expect(authorized.errors).toEqual([]);
    expect(authorized.activeChanges).toEqual(["attach-the-browser"]);
  });
});
