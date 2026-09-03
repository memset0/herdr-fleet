import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "bun:test";

import { childBackoffMs } from "./managed-child.ts";
import { childSpecs, computeGeneration, resolveRuntimePaths, sanitizedDaemonEnv } from "./runtime.ts";
import {
  fleetTestConfig,
  fleetTestPackLeadConfig,
  fleetTestPackPeerConfig,
} from "./test-helpers.ts";

const root = resolve(import.meta.dir, "..");

function actionBlocks(manifest: string): string[] {
  return manifest.split("[[actions]]").slice(1);
}

function validatePushActions(manifest: string): void {
  const pushBlocks = actionBlocks(manifest).filter((block) => /\nid = "push-[^"]+"/.test(`\n${block}`));
  if (pushBlocks.length !== 2) throw new Error("manifest must contain exactly two Push actions");
  for (const id of ["push-keys", "push-test"] as const) {
    const matches = pushBlocks.filter((block) => block.includes(`id = "${id}"`));
    if (matches.length !== 1) throw new Error(`manifest must contain exactly one ${id} action`);
    const block = matches[0] ?? "";
    const command = `command = ["bash", "scripts/collie-ctl.sh", "${id}"]`;
    if (!block.includes(command)) throw new Error(`${id} must delegate to the frozen Collie shim`);
    if (/--force|COLLIE_VAPID_|https?:|mailto:|push (list|forget)/.test(block)) {
      throw new Error(`${id} embeds forbidden Push arguments or values`);
    }
  }
}

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
    expect(specs[0]?.env.HERDR_FLEET_CONFIG).toBeUndefined();
    expect(specs[0]?.env.HERDR_FLEET_SESSION_STATE).toBeUndefined();
    expect(specs[1]?.command).toEqual([process.execPath, "run", `${root}/fleet/gateway-main.ts`]);
    expect(specs[1]?.env.HERDR_FLEET_SESSION_STATE).toBe("/private/state/sessions.json");
  });

  test("composes native Pack lead and peer children without a peer Gateway", () => {
    const paths = resolveRuntimePaths({
      HERDR_PLUGIN_ROOT: root,
      HERDR_FLEET_CONFIG: "/private/config/fleet.toml",
      HERDR_PLUGIN_STATE_DIR: "/private/state",
      XDG_RUNTIME_DIR: "/private/runtime",
      HERDR_FLEET_GENERATION: "generation-a",
    });
    const lead = childSpecs(fleetTestPackLeadConfig(), paths, { PATH: "/usr/bin" });
    expect(lead.map((spec) => spec.name)).toEqual(["collie", "gateway"]);
    const peer = childSpecs(fleetTestPackPeerConfig(), paths, {
      PATH: "/usr/bin",
      HERDR_FLEET_SESSION_STATE: "/inherited/sessions.json",
      COLLIE_PUBLIC_URL: "https://inherited.example",
    });
    expect(peer.map((spec) => spec.name)).toEqual(["collie", "link"]);
    expect(peer[0]?.env).toMatchObject({
      COLLIE_HOST: "::1",
      COLLIE_PORT: "8787",
      COLLIE_SKIP_SERVE: "1",
      HERDR_PLUGIN_STATE_DIR: "/private/state/collie",
    });
    expect(peer[0]?.env.HERDR_FLEET_SESSION_STATE).toBeUndefined();
    expect(peer[0]?.env.COLLIE_PUBLIC_URL).toBeUndefined();

    // The link runs the platform SSH client and carries none of Fleet's own environment.
    const link = peer[1];
    expect(link?.command[0]).toBe("ssh");
    expect(link?.logPath).toBe("/private/state/link.log");
    expect(link?.maxBackoffMs).toBe(60_000);
    expect(link?.env.HERDR_FLEET_CONFIG).toBeUndefined();
    expect(link?.env.HERDR_FLEET_SESSION_STATE).toBeUndefined();
    expect(link?.env.HERDR_PLUGIN_STATE_DIR).toBeUndefined();
    // A Lead has no link child, and neither Lead branch gains one.
    expect(childSpecs(fleetTestConfig(), paths, { PATH: "/usr/bin" }).map((spec) => spec.name)).toEqual([
      "collie",
      "gateway",
    ]);
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
      "pack-authority.ts",
      "pack-reachability.ts",
      "protocol.ts",
      "proxy.ts",
      "rate-limit.ts",
      "runtime.ts",
      "server.ts",
      "session-store.ts",
    ];
    const source = files.map((file) => readFileSync(resolve(import.meta.dir, file), "utf8")).join("\n");
    // `ssh-reverse` is now implemented, so it left this list. Everything here is still deferred, and
    // `ssh-forward` stays out precisely because nothing consumes it yet.
    for (const forbidden of ["iframe", "ttyd", "discord", "ssh-forward"]) {
      expect(source.toLowerCase()).not.toContain(forbidden);
    }
    // The enrolment, rotation and aggregation verbs stay Collie's, not Fleet's.
    for (const forbidden of ["pack invite", "pack join", "pack rotate", "pack approve", "truststore.update"]) {
      expect(source.toLowerCase()).not.toContain(forbidden);
    }
  });

  test("validates native Pack authority and link material before constructing children", () => {
    const source = readFileSync(resolve(import.meta.dir, "daemon.ts"), "utf8");
    const children = source.indexOf("const children = childSpecs(config, paths, process.env)");
    expect(source.indexOf("await validatePackAuthority(config, paths.collieStateDir);")).toBeLessThan(
      children,
    );
    expect(source.indexOf("await assertLinkFiles(config.transport);")).toBeLessThan(children);
  });

  test("the plugin manifest delegates only to the thin Fleet launcher", () => {
    const manifest = readFileSync(resolve(root, "herdr-plugin.toml"), "utf8");
    expect(manifest).toContain('id = "memset0.herdr-fleet"');
    expect(manifest).not.toContain("systemctl");
    expect(manifest).not.toContain("tailscale");
    expect(manifest.match(/scripts\/herdr-fleet\.sh/g)?.length).toBe(6);
  });

  test("the plugin manifest exposes only the two native no-argument Push actions", () => {
    const manifest = readFileSync(resolve(root, "herdr-plugin.toml"), "utf8");
    expect(() => validatePushActions(manifest)).not.toThrow();
    expect(() =>
      validatePushActions(
        `${manifest}\n[[actions]]\nid = "push-test"\ncommand = ["bash", "scripts/collie-ctl.sh", "push-test"]\n`,
      ),
    ).toThrow();
    expect(() =>
      validatePushActions(manifest.replace('"push-keys"]', '"push-keys", "--force"]')),
    ).toThrow();
    expect(() =>
      validatePushActions(
        manifest.replace(
          '"scripts/collie-ctl.sh", "push-test"',
          '"scripts/herdr-fleet.sh", "push-test"',
        ),
      ),
    ).toThrow();
    expect(() =>
      validatePushActions(
        `${manifest}\n[[actions]]\nid = "push-list"\ncommand = ["bash", "scripts/collie-ctl.sh", "push", "list"]\n`,
      ),
    ).toThrow();
  });
});
