import { describe, expect, test } from "bun:test";

import { parseForkManifest, splitInvasivePath } from "./fork-manifest.ts";

const valid = `schema_version = 1

[upstream]
url = "https://github.com/example/collie.git"
tag = "v0.34.0"
commit = "0c647372d89d50ec62dfe8b569e9109a830660e5"

[[owned]]
id = "fleet-gateway"
intent = "Provide a synthetic Fleet boundary."
paths = ["gateway/**"]
contracts = ["snapshot schema"]
verify = ["gateway/fleet.test.ts"]

[[invasive]]
id = "fleet-port"
intent = "Expose one synthetic port."
strategy = "keep"
review = "every-upstream-sync"
paths = ["web/src/App.tsx#App"]
verify = ["web/src/App.test.tsx"]
reason = "The host owns application bootstrap."
`;

describe("FORK.toml parser", () => {
  test("parses distinct owned and invasive collections", () => {
    const manifest = parseForkManifest(valid);
    expect(manifest.upstream.tag).toBe("v0.34.0");
    expect(manifest.owned[0]?.paths).toEqual(["gateway/**"]);
    expect(manifest.invasive[0]?.paths).toEqual(["web/src/App.tsx#App"]);
    expect(splitInvasivePath("web/src/App.tsx#App")).toEqual({
      path: "web/src/App.tsx",
      anchor: "App",
    });
  });

  test("rejects unknown fields, duplicate ids, and duplicate paths", () => {
    expect(() => parseForkManifest(valid.replace('tag = "v0.34.0"', 'tag = "v0.34.0"\nbranch = "main"'))).toThrow(
      "unknown field branch",
    );
    expect(() => parseForkManifest(valid.replace('id = "fleet-port"', 'id = "fleet-gateway"'))).toThrow(
      "duplicate fork entry id",
    );
    expect(() =>
      parseForkManifest(
        valid.replace(
          'reason = "The host owns application bootstrap."',
          'reason = "The host owns application bootstrap."\n\n[[invasive]]\nid = "second"\nintent = "Second."\nstrategy = "keep"\nreview = "every-upstream-sync"\npaths = ["web/src/App.tsx#App"]\nverify = ["web/src/App.test.tsx"]\nreason = "Synthetic."',
        ),
      ),
    ).toThrow("duplicate fork path");
  });

  test("rejects malformed identities, unsafe paths, globs, and strategies", () => {
    expect(() => parseForkManifest(valid.replace(/0c[0-9a-f]{38}/, "not-a-commit"))).toThrow("commit is malformed");
    expect(() => parseForkManifest(valid.replace("gateway/**", "../gateway/**"))).toThrow("unsafe path");
    expect(() => parseForkManifest(valid.replace("web/src/App.tsx#App", "web/src/*.tsx#App"))).toThrow(
      "not exact",
    );
    expect(() => parseForkManifest(valid.replace('strategy = "keep"', 'strategy = "maybe"'))).toThrow(
      "strategy is invalid",
    );
  });

  test("requires exact verification paths and stable invasive anchors", () => {
    expect(() => parseForkManifest(valid.replace("gateway/fleet.test.ts", "gateway/*.test.ts"))).toThrow(
      "verify must use exact paths",
    );
    expect(() => parseForkManifest(valid.replace("web/src/App.tsx#App", "web/src/App.tsx"))).toThrow(
      "must contain an exact #anchor",
    );
  });
});
