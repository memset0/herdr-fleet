import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { resolveStateDir } from "../bridge/config.ts";
import { settingByEnv } from "../bridge/config-schema.ts";
import { CREW_TIMEOUT_ENV } from "../bridge/crew/peer-client.ts";
import { assertCollieConfigFilesCede, collieChildEnv, FLEET_OWNED_COLLIE_SETTINGS } from "./collie-env.ts";
import { parseFleetToml } from "./config.ts";
import { collieSpecEnv, resolveRuntimePaths } from "./runtime.ts";
import { fleetTestPackLeadConfig, fleetTestPackPeerConfig } from "./test-helpers.ts";

/** The previous spelling of the probe budget, which the adopted Collie no longer reads. */
const RETIRED_CREW_TIMEOUT_ENV = "COLLIE_PACK_TIMEOUT_MS";
const STATE = "/private/state/collie";

const config = parseFleetToml(`schema_version = 1
role = "lead"
[listen]
host = "127.0.0.1"
port = 18787
[public]
origin = "https://fleet.example.com"
[collie]
host = "127.0.0.1"
port = 8787
[auth]
username = "operator"
password_hash = "$argon2id$v=19$m=65536,t=3,p=1$c2FsdA$aGFzaA"
session_secret = "${Buffer.alloc(32, 9).toString("base64url")}"
`);

describe("Fleet Collie child environment", () => {
  test("forces external ingress and removes inherited trust bypasses", () => {
    const inherited = {
      PATH: "/usr/bin",
      COLLIE_HOST: "0.0.0.0",
      COLLIE_ALLOW_NON_LOOPBACK_BIND: "1",
      COLLIE_TRUSTED_USER: "forged@example.com",
      COLLIE_TRUSTED_USER_OPTIONAL: "1",
      COLLIE_TAILSCALE_HOSTS: "old.example.com",
      COLLIE_SERVE_MODE: "https",
      COLLIE_DEVICE_HEADER: "X-Trusted",
      COLLIE_ALLOW_ANY_HOST: "1",
      HERDR_FLEET_CONFIG: "/private/fleet.toml",
      HERDR_FLEET_SESSION_STATE: "/private/sessions.json",
    };
    const env = collieChildEnv(config, STATE, inherited);
    expect(env).toMatchObject({
      PATH: "/usr/bin",
      COLLIE_HOST: "127.0.0.1",
      COLLIE_PORT: "8787",
      COLLIE_SKIP_SERVE: "1",
      COLLIE_PUBLIC_HOSTS: "fleet.example.com",
      COLLIE_ALLOWED_ORIGINS: "https://fleet.example.com",
      COLLIE_PUBLIC_URL: "https://fleet.example.com",
    });
    for (const key of [
      "COLLIE_ALLOW_NON_LOOPBACK_BIND",
      "COLLIE_TRUSTED_USER",
      "COLLIE_TRUSTED_USER_OPTIONAL",
      "COLLIE_TAILSCALE_HOSTS",
      "COLLIE_SERVE_MODE",
      "COLLIE_DEVICE_HEADER",
      "COLLIE_ALLOW_ANY_HOST",
      "HERDR_FLEET_CONFIG",
      "HERDR_FLEET_SESSION_STATE",
    ]) {
      expect(env[key]).toBeUndefined();
    }
    expect(inherited.COLLIE_HOST).toBe("0.0.0.0");
  });

  test("keeps a peer loopback-only without public browser or Fleet credential values", () => {
    const env = collieChildEnv(fleetTestPackPeerConfig(), STATE, {
      PATH: "/usr/bin",
      COLLIE_PUBLIC_HOSTS: "inherited.example",
      COLLIE_ALLOWED_ORIGINS: "https://inherited.example",
      COLLIE_PUBLIC_URL: "https://inherited.example",
      HERDR_FLEET_CONFIG: "/private/fleet.toml",
      HERDR_FLEET_SESSION_STATE: "/private/sessions.json",
    });
    expect(env).toMatchObject({
      PATH: "/usr/bin",
      COLLIE_HOST: "::1",
      COLLIE_PORT: "8787",
      COLLIE_SKIP_SERVE: "1",
    });
    for (const key of [
      "COLLIE_PUBLIC_HOSTS",
      "COLLIE_ALLOWED_ORIGINS",
      "COLLIE_PUBLIC_URL",
      "HERDR_FLEET_CONFIG",
      "HERDR_FLEET_SESSION_STATE",
    ]) {
      expect(env[key]).toBeUndefined();
    }
  });

  test("the lead's own pack timing is what Collie is started with, under the crew name only", () => {
    const timed = { ...fleetTestPackLeadConfig(), pack: { pollMs: 3000, timeoutMs: 2400 } };
    const env = collieChildEnv(timed, STATE, { PATH: "/usr/bin" });
    expect(env.COLLIE_POLL_MS).toBe("3000");
    expect(env[CREW_TIMEOUT_ENV]).toBe("2400");
    expect(env[RETIRED_CREW_TIMEOUT_ENV]).toBeUndefined();
  });

  test("the names projected are the ones the adopted Collie reads", () => {
    expect(CREW_TIMEOUT_ENV).toBe("COLLIE_CREW_TIMEOUT_MS");
    expect(settingByEnv(CREW_TIMEOUT_ENV)?.env).toBe(CREW_TIMEOUT_ENV);
    // The previous spelling is no longer a Collie setting under any name or alias, so it decides
    // nothing and Fleet carries no reset for it.
    expect(settingByEnv(RETIRED_CREW_TIMEOUT_ENV)).toBeUndefined();
    expect(FLEET_OWNED_COLLIE_SETTINGS).not.toContain(RETIRED_CREW_TIMEOUT_ENV);
  });

  test("stating neither leaves Collie's own defaults alone under either spelling", () => {
    const env = collieChildEnv(fleetTestPackLeadConfig(), STATE, { PATH: "/usr/bin" });
    expect(env.COLLIE_POLL_MS).toBeUndefined();
    expect(env[CREW_TIMEOUT_ENV]).toBeUndefined();
    expect(env[RETIRED_CREW_TIMEOUT_ENV]).toBeUndefined();
  });

  test("an inherited value cannot decide how long a member has to answer", () => {
    // Reset before it is set, like every other key the configuration owns: a stray variable in the
    // environment must not be able to shorten the budget the operator wrote down.
    const inherited = { PATH: "/usr/bin", COLLIE_POLL_MS: "250", [CREW_TIMEOUT_ENV]: "100" };
    const omitted = collieChildEnv(fleetTestPackLeadConfig(), STATE, inherited);
    expect(omitted.COLLIE_POLL_MS).toBeUndefined();
    expect(omitted[CREW_TIMEOUT_ENV]).toBeUndefined();
    const stated = collieChildEnv({ ...fleetTestPackLeadConfig(), pack: { pollMs: 3000 } }, STATE, inherited);
    expect(stated.COLLIE_POLL_MS).toBe("3000");
    expect(stated[CREW_TIMEOUT_ENV]).toBeUndefined();
    const budget = collieChildEnv({ ...fleetTestPackLeadConfig(), pack: { timeoutMs: 800 } }, STATE, inherited);
    expect(budget[CREW_TIMEOUT_ENV]).toBe("800");
  });

  test("an inherited previous budget spelling is neither set nor projected", () => {
    const env = collieChildEnv(fleetTestPackLeadConfig(), STATE, { PATH: "/usr/bin", [RETIRED_CREW_TIMEOUT_ENV]: "90" });
    expect(env[CREW_TIMEOUT_ENV]).toBeUndefined();
    // Passed through untouched: Collie reads no such name, so it decides nothing.
    expect(env[RETIRED_CREW_TIMEOUT_ENV]).toBe("90");
  });

  test("an inherited base path never reaches Collie, which stays at the root the Gateway proxies", () => {
    const env = collieChildEnv(fleetTestPackLeadConfig(), STATE, { PATH: "/usr/bin", COLLIE_BASE_PATH: "/collie" });
    expect(env.COLLIE_BASE_PATH).toBeUndefined();
  });
});

describe("Fleet states the Collie child's state directory", () => {
  test("the child env names Fleet's directory, whatever the inherited environment carried", () => {
    const env = collieChildEnv(fleetTestPackLeadConfig(), STATE, {
      PATH: "/usr/bin",
      COLLIE_STATE_DIR: "/inherited/elsewhere",
      HERDR_PLUGIN_STATE_DIR: "/inherited/plugin-state",
    });
    expect(env.COLLIE_STATE_DIR).toBe(STATE);
  });

  test("Collie's own resolver lands on exactly the directory Fleet validates trust in", () => {
    const paths = resolveRuntimePaths({
      HERDR_PLUGIN_ROOT: "/private/plugin",
      HERDR_FLEET_CONFIG: "/private/config/fleet.toml",
      HERDR_PLUGIN_STATE_DIR: "/private/state",
      XDG_RUNTIME_DIR: "/private/runtime",
      HERDR_FLEET_GENERATION: "generation-a",
    });
    // `paths.collieStateDir` is what the daemon and the control entry hand `validatePackAuthority`.
    const env = collieSpecEnv(fleetTestPackLeadConfig(), paths, {
      PATH: "/usr/bin",
      COLLIE_STATE_DIR: "/inherited/elsewhere",
      HERDR_PLUGIN_STATE_DIR: "/inherited/plugin-state",
    });
    expect(resolveStateDir(env, "/nonexistent-home")).toBe(paths.collieStateDir);
    expect(paths.collieStateDir).toBe("/private/state/collie");
  });
});

describe("Collie's configuration files cannot decide a Fleet-owned setting", () => {
  /** The refusal's message, so a test can say what it must NOT carry. */
  function refusal(env: NodeJS.ProcessEnv): string {
    try {
      assertCollieConfigFilesCede(env);
    } catch (caught) {
      return caught instanceof Error ? caught.message : String(caught);
    }
    throw new Error("expected a refusal");
  }

  async function withDirs(run: (env: NodeJS.ProcessEnv, home: string, configDir: string) => Promise<void>): Promise<void> {
    const root = await mkdtemp(join(tmpdir(), "herdr-fleet-collie-config-"));
    const home = join(root, "home");
    const configDir = join(root, "config");
    try {
      await mkdir(join(home, ".collie"), { recursive: true });
      await mkdir(configDir, { recursive: true });
      const env = collieChildEnv(fleetTestPackLeadConfig(), STATE, {
        PATH: "/usr/bin",
        HOME: home,
        HERDR_PLUGIN_CONFIG_DIR: configDir,
      });
      await run(env, home, configDir);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }

  test("no file at all starts", async () => {
    await withDirs(async (env) => {
      expect(() => assertCollieConfigFilesCede(env)).not.toThrow();
    });
  });

  test("a file that sets only settings Fleet does not own starts", async () => {
    await withDirs(async (env, home, configDir) => {
      await writeFile(join(home, ".collie", "config.toml"), '[stt]\nstt_lang = "en"\n');
      await writeFile(join(configDir, "config.toml"), "[bridge]\nread_lines = 300\n");
      expect(() => assertCollieConfigFilesCede(env)).not.toThrow();
    });
  });

  test("an owned key in the machine file refuses, naming the file and key and never the value", async () => {
    await withDirs(async (env, home) => {
      const file = join(home, ".collie", "config.toml");
      await writeFile(file, '[network]\nhost = "0.0.0.0"\n');
      expect(() => assertCollieConfigFilesCede(env)).toThrow(`${file} sets [network] host, which Herdr Fleet owns`);
      expect(refusal(env)).not.toContain("0.0.0.0");
    });
  });

  test("an owned key in the instance file refuses, naming that file", async () => {
    await withDirs(async (env, _home, configDir) => {
      const file = join(configDir, "config.toml");
      await writeFile(file, '[serve]\nbase_path = "/hidden-mount"\n');
      expect(() => assertCollieConfigFilesCede(env)).toThrow(`${file} sets [serve] base_path, which Herdr Fleet owns`);
      expect(refusal(env)).not.toContain("hidden-mount");
      await writeFile(file, '[access]\ntrusted_user = "someone@example.com"\n');
      expect(() => assertCollieConfigFilesCede(env)).toThrow(`${file} sets [access] trusted_user`);
      expect(refusal(env)).not.toContain("someone@example.com");
      await writeFile(file, '[bridge]\nstate_dir = "/elsewhere"\n');
      expect(() => assertCollieConfigFilesCede(env)).toThrow(`${file} sets [bridge] state_dir`);
    });
  });

  test("an owned key with a value Collie would reject is still refused", async () => {
    await withDirs(async (env, _home, configDir) => {
      const file = join(configDir, "config.toml");
      await writeFile(file, '[network]\nport = "not-a-port"\n');
      expect(() => assertCollieConfigFilesCede(env)).toThrow(`${file} sets [network] port`);
      expect(refusal(env)).not.toContain("not-a-port");
    });
  });

  test("the machine file Collie is pointed at is the one read", async () => {
    await withDirs(async (env, home) => {
      const named = join(home, "elsewhere.toml");
      await writeFile(named, "[network]\nport = 9999\n");
      expect(() => assertCollieConfigFilesCede(env)).not.toThrow();
      expect(() => assertCollieConfigFilesCede({ ...env, COLLIE_CONFIG: named })).toThrow(`${named} sets [network] port`);
    });
  });
});
