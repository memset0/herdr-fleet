import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  CHANGELOG_SEAM,
  checkForkClassification,
  parseGitChanges,
  parseTargetDiff,
  planUpstreamAdoption,
  preflightInput,
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

  test("the target diff counts both sides of a rename and keeps the pairing", () => {
    const diff = parseTargetDiff(
      [
        "R074\tbridge/pack/forward.ts\tbridge/crew/forward.ts",
        "R100\tPACK_PROTOCOL.md\tCREW_PROTOCOL.md",
        "A\tbridge/crew/state-migration.ts",
        "M\tpackage.json",
        "D\tbridge/retired.ts",
        "T\tCLAUDE.md",
        "",
      ].join("\n"),
    );
    expect([...diff.changed].toSorted()).toEqual([
      "CLAUDE.md",
      "CREW_PROTOCOL.md",
      "PACK_PROTOCOL.md",
      "bridge/crew/forward.ts",
      "bridge/crew/state-migration.ts",
      "bridge/pack/forward.ts",
      "bridge/retired.ts",
      "package.json",
    ]);
    expect([...diff.renames]).toEqual([
      ["bridge/pack/forward.ts", "bridge/crew/forward.ts"],
      ["PACK_PROTOCOL.md", "CREW_PROTOCOL.md"],
    ]);
  });

  test("the target diff refuses a row it does not understand", () => {
    expect(() => parseTargetDiff("R100\tonly-source.ts\n")).toThrow("rename row has no destination");
    expect(() => parseTargetDiff("X\tunknown.ts\n")).toThrow("unexpected git diff status X");
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
      renames: new Map(),
      targetFiles: new Set(["package.json", "bridge/server.ts"]),
      ...overrides,
    });

  test("reports the ports the release disturbs, and the ones it leaves alone", () => {
    const report = plan();
    expect(report.errors).toEqual([]);
    expect(report.disturbed).toEqual([{ id: "host-port", paths: ["package.json"], moved: [] }]);
    expect(report.undisturbed).toEqual([]);
    expect(report.collisions).toEqual([]);
  });

  test("a declared path the release renamed is disturbed, and its destination is named", () => {
    const renamed = parseForkManifest(source.replace('paths = ["package.json#fleet"]', 'paths = ["bridge/pack/forward.ts#resize"]'));
    const report = planUpstreamAdoption(renamed, {
      dirty: [],
      activeChanges: [],
      allowActiveChanges: false,
      tagObject: "a326aedc6a44572cea51432545ea5762acc42648",
      commit: "ba39c05c6350a52bcb0a88f118cd0680ff85a1c5",
      mergeBase: baseline,
      changedPaths: new Set(["bridge/pack/forward.ts", "bridge/crew/forward.ts"]),
      renames: new Map([["bridge/pack/forward.ts", "bridge/crew/forward.ts"]]),
      targetFiles: new Set(["bridge/crew/forward.ts"]),
    });
    expect(report.disturbed).toEqual([
      {
        id: "host-port",
        paths: ["bridge/pack/forward.ts"],
        moved: [{ path: "bridge/pack/forward.ts", destination: "bridge/crew/forward.ts" }],
      },
    ]);
    expect(report.undisturbed).toEqual([]);
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

describe("upstream adoption preflight against a real repository", () => {
  const isolated = {
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: "Example",
    GIT_AUTHOR_EMAIL: "example@example.com",
    GIT_COMMITTER_NAME: "Example",
    GIT_COMMITTER_EMAIL: "example@example.com",
  } as const;

  function run(cwd: string, ...args: string[]): string {
    const result = Bun.spawnSync(["git", ...args], { cwd, env: { ...process.env, ...isolated }, stdout: "pipe", stderr: "pipe" });
    if (result.exitCode !== 0) throw new Error(result.stderr.toString());
    return result.stdout.toString().trim();
  }

  test("reports a renamed declared path identically whatever diff.renames says", () => {
    const root = mkdtempSync(join(tmpdir(), "check-fork-"));
    const saved = new Map(Object.keys(isolated).map((key) => [key, process.env[key]] as const));
    Object.assign(process.env, isolated);
    try {
      run(root, "init", "--quiet", "--initial-branch=main");
      mkdirSync(join(root, "bridge/pack"), { recursive: true });
      const body = Array.from({ length: 40 }, (_, index) => `export const line${index} = ${index};`).join("\n");
      writeFileSync(join(root, "bridge/pack/forward.ts"), `${body}\n`);
      writeFileSync(join(root, "package.json"), "{}\n");
      run(root, "add", "--all");
      run(root, "commit", "--quiet", "-m", "baseline");
      const baseline = run(root, "rev-parse", "HEAD");

      run(root, "checkout", "--quiet", "-b", "upstream");
      mkdirSync(join(root, "bridge/crew"), { recursive: true });
      run(root, "mv", "bridge/pack/forward.ts", "bridge/crew/forward.ts");
      writeFileSync(join(root, "bridge/crew/forward.ts"), `${body}\nexport const renamed = true;\n`);
      run(root, "add", "--all");
      run(root, "commit", "--quiet", "-m", "rename the link");
      run(root, "tag", "-a", "v2.0.0", "-m", "v2.0.0");
      run(root, "checkout", "--quiet", "main");
      writeFileSync(join(root, "fork.txt"), "downstream\n");
      run(root, "add", "fork.txt");
      run(root, "commit", "--quiet", "-m", "fork work");

      const manifest = parseForkManifest(
        source
          .replace('commit = "4618c90534d6f818ed6788b8db00e1582c5abfdc"', `commit = "${baseline}"`)
          .replace('paths = ["package.json#fleet"]', 'paths = ["bridge/pack/forward.ts#resize"]'),
      );
      const reports = ["false", "true", null].map((setting) => {
        if (setting === null) Bun.spawnSync(["git", "config", "--unset", "diff.renames"], { cwd: root });
        else run(root, "config", "diff.renames", setting);
        return planUpstreamAdoption(manifest, preflightInput(root, "v2.0.0", false, manifest));
      });

      for (const report of reports) {
        expect(report.errors).toEqual([]);
        expect(report.disturbed).toEqual([
          {
            id: "host-port",
            paths: ["bridge/pack/forward.ts"],
            moved: [{ path: "bridge/pack/forward.ts", destination: "bridge/crew/forward.ts" }],
          },
        ]);
      }
    } finally {
      for (const [key, value] of saved) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      rmSync(root, { recursive: true, force: true });
    }
  });
});
