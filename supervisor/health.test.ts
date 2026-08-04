import { describe, expect, test } from "bun:test";
import type { spawnSync } from "node:child_process";

import { herdrServerActive, pluginEnabled } from "./health.ts";

function runner(status: number, stdout: string, error?: Error): typeof spawnSync {
  return (() => ({ status, stdout, stderr: "", error })) as unknown as typeof spawnSync;
}

describe("supervisor ownership health", () => {
  test("requires an explicitly running Herdr server", () => {
    expect(herdrServerActive({}, runner(0, "status: running\n"))).toBeTrue();
    expect(herdrServerActive({}, runner(0, "status: stopped\n"))).toBeFalse();
    expect(herdrServerActive({}, runner(1, "status: running\n"))).toBeFalse();
  });

  test("requires the exact plugin registration to remain enabled", () => {
    const enabled = JSON.stringify({
      result: { plugins: [{ plugin_id: "memset0.web-remote", enabled: true }] },
    });
    expect(pluginEnabled({}, runner(0, enabled))).toBeTrue();
    expect(pluginEnabled({}, runner(0, enabled.replace("true", "false")))).toBeFalse();
    expect(pluginEnabled({}, runner(0, "not json"))).toBeFalse();
  });
});
