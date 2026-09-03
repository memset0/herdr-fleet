import { describe, expect, test } from "bun:test";

import { checkForkClassification, parseGitChanges } from "./check-fork.ts";
import { parseForkManifest } from "./fork-manifest.ts";

const source = `schema_version = 1
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
paths = ["package.json#fleet"]
verify = ["fleet/config.test.ts"]
reason = "The root package owns the test entrypoint."
`;

const files = new Map([
  ["fleet/config.ts", "export {};"],
  ["fleet/config.test.ts", "test('config', () => {});"],
  ["package.json", '{"scripts":{"test":"bun test ./fleet"}}'],
]);

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
    });
    expect(result.errors).toContain("unclassified owned path other/new.ts");
    expect(result.errors).toContain("unclassified invasive path bridge/server.ts");
    expect(result.errors).toContain("owned entry fleet collides with upstream path fleet/upstream.ts");
  });

  test("parses renames as one deletion and one addition", () => {
    expect(parseGitChanges("R100\told.ts\tnew.ts\n")).toEqual([
      { status: "deleted", path: "old.ts" },
      { status: "added", path: "new.ts" },
    ]);
  });
});
