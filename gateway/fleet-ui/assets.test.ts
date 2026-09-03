import { beforeAll, describe, expect, test } from "bun:test";

import { buildFleetAssets } from "../../scripts/build-fleet-assets.ts";
import { fleetAssetFile, fleetAssetResponse } from "./assets.ts";

beforeAll(buildFleetAssets);

describe("Fleet build assets", () => {
  test("builds an exact non-empty JS/CSS pair", async () => {
    expect(await fleetAssetFile("fleet.css").exists()).toBeTrue();
    expect(await fleetAssetFile("fleet.js").exists()).toBeTrue();
    expect((await fleetAssetFile("fleet.css").text()).length).toBeGreaterThan(
      1_000,
    );
    expect((await fleetAssetFile("fleet.js").text()).length).toBeGreaterThan(
      1_000,
    );
  });

  test("rejects names outside the allowlist", () => {
    expect(() => fleetAssetFile("../secret" as "fleet.js")).toThrow(
      "unsupported Fleet asset",
    );
  });

  test("applies explicit content types", async () => {
    expect(
      (await fleetAssetResponse("fleet.css")).headers.get("content-type"),
    ).toBe("text/css; charset=utf-8");
    expect(
      (await fleetAssetResponse("fleet.js")).headers.get("content-type"),
    ).toBe("text/javascript; charset=utf-8");
  });
});
