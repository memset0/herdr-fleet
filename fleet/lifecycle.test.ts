import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "bun:test";

import { childBackoffMs } from "./managed-child.ts";
import { childSpecs, computeGeneration, resolveRuntimePaths, sanitizedDaemonEnv } from "./runtime.ts";
import { fleetTestConfig } from "./test-helpers.ts";

const root = resolve(import.meta.dir, "..");

describe("Herdr-owned Fleet lifecycle", () => {
  test("derives private generation-qualified paths without process-name or port ownership", () => {
    const paths = resolveRuntimePaths({
      HERDR_PLUGIN_ROOT: root,
      HERDR_FLEET_CONFIG: "/private/config/fleet.toml",
      HERDR_PLUGIN_STATE_DIR: "/private/state",
      XDG_RUNTIME_DIR: "/private/runtime",
      HERDR_FLEET_GENERATION: "generation-a",
    });
    expect(paths).toMatchObject({
      pluginRoot: root,
      configPath: "/private/config/fleet.toml",
      stateDir: "/private/state",
      collieStateDir: "/private/state/collie",
      sessionStatePath: "/private/state/sessions.json",
      generation: "generation-a",
    });
    expect(paths.socketPath).toEndWith("/supervisor.sock");
    expect(computeGeneration(root)).toMatch(/^[0-9a-f]{16}$/);
  });

  test("builds exactly one Collie and one Gateway child with isolated state", () => {
    const paths = resolveRuntimePaths({
      HERDR_PLUGIN_ROOT: root,
      HERDR_FLEET_CONFIG: "/private/config/fleet.toml",
      HERDR_PLUGIN_STATE_DIR: "/private/state",
      XDG_RUNTIME_DIR: "/private/runtime",
      HERDR_FLEET_GENERATION: "generation-a",
    });
    const specs = childSpecs(fleetTestConfig(), paths, {
      PATH: "/usr/bin",
      COLLIE_TRUSTED_USER: "must-be-removed",
    });
    expect(specs.map((spec) => spec.name)).toEqual(["collie", "gateway"]);
    expect(specs[0]?.command).toEqual([`${root}/bin/collie`, "_exec-bridge"]);
    expect(specs[0]?.env).toMatchObject({
      COLLIE_SKIP_SERVE: "1",
      HERDR_PLUGIN_STATE_DIR: "/private/state/collie",
    });
    expect(specs[0]?.env.COLLIE_TRUSTED_USER).toBeUndefined();
    expect(specs[1]?.command).toEqual([process.execPath, "run", `${root}/fleet/gateway-main.ts`]);
    expect(specs[1]?.env.HERDR_FLEET_SESSION_STATE).toBe("/private/state/sessions.json");
  });

  test("uses bounded exponential child restart delays", () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((attempt) => childBackoffMs(attempt))).toEqual([
      1_000,
      2_000,
      4_000,
      8_000,
      16_000,
      30_000,
      30_000,
    ]);
  });

  test("drops transient Herdr action context before the daemon outlives the action", () => {
    const inherited = {
      PATH: "/usr/bin",
      HERDR_PLUGIN_ACTION_ID: "start",
      HERDR_PLUGIN_CONTEXT_JSON: "sensitive action context",
      HERDR_PANE_ID: "pane-a",
    };
    expect(sanitizedDaemonEnv(inherited)).toEqual({ PATH: "/usr/bin" });
    expect(inherited.HERDR_PLUGIN_ACTION_ID).toBe("start");
  });

  test("keeps deferred product families out of production Fleet modules", () => {
    const files = [
      "auth.ts",
      "collie-env.ts",
      "config.ts",
      "control.ts",
      "daemon.ts",
      "gateway-main.ts",
      "gateway.ts",
      "login-ui.ts",
      "managed-child.ts",
      "protocol.ts",
      "proxy.ts",
      "rate-limit.ts",
      "runtime.ts",
      "server.ts",
      "session-store.ts",
    ];
    const source = files.map((file) => readFileSync(resolve(import.meta.dir, file), "utf8")).join("\n");
    for (const forbidden of ["iframe", "ttyd", "discord", "ssh-reverse", "ssh-forward"]) {
      expect(source.toLowerCase()).not.toContain(forbidden);
    }
  });

  test("the plugin manifest delegates only to the thin Fleet launcher", () => {
    const manifest = readFileSync(resolve(root, "herdr-plugin.toml"), "utf8");
    expect(manifest).toContain('id = "memset0.herdr-fleet"');
    expect(manifest).not.toContain("systemctl");
    expect(manifest).not.toContain("tailscale");
    expect(manifest.match(/scripts\/herdr-fleet\.sh/g)?.length).toBe(6);
  });
});
