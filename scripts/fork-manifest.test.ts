import { describe, expect, test } from "bun:test";

import { parseForkManifest, splitInvasivePath } from "./fork-manifest.ts";

const valid = `schema_version = 1
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

describe("FORK.toml", () => {
  test("parses exact upstream, owned, and invasive entries", () => {
    const manifest = parseForkManifest(valid);
    expect(manifest.upstream.commit).toBe("4618c90534d6f818ed6788b8db00e1582c5abfdc");
    expect(manifest.owned[0]?.paths).toEqual(["fleet/**"]);
    expect(splitInvasivePath("package.json#fleet")).toEqual({ path: "package.json", anchor: "fleet" });
  });

  test("rejects unknown fields and overbroad or non-exact paths", () => {
    expect(() => parseForkManifest(valid.replace("tag =", "branch = \"main\"\ntag ="))).toThrow("unknown field");
    expect(() => parseForkManifest(valid.replace("fleet/**", "**"))).toThrow("overbroad");
    expect(() => parseForkManifest(valid.replace("package.json#fleet", "package*.json#fleet"))).toThrow("not exact");
  });

  test("rejects duplicate ids and unsupported strategies", () => {
    expect(() => parseForkManifest(valid.replace('id = "host-port"', 'id = "fleet"'))).toThrow("duplicate fork entry id");
    expect(() => parseForkManifest(valid.replace('strategy = "adapt"', 'strategy = "unknown"'))).toThrow("strategy is invalid");
  });
});
