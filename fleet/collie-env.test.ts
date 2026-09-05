import { describe, expect, test } from "bun:test";

import { collieChildEnv } from "./collie-env.ts";
import { parseFleetToml } from "./config.ts";
import { fleetTestPackLeadConfig, fleetTestPackPeerConfig } from "./test-helpers.ts";

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
    const env = collieChildEnv(config, inherited);
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
    const env = collieChildEnv(fleetTestPackPeerConfig(), {
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

  test("the lead's own pack timing is what Collie is started with", () => {
    const timed = { ...fleetTestPackLeadConfig(), pack: { pollMs: 3000, timeoutMs: 2400 } };
    const env = collieChildEnv(timed, { PATH: "/usr/bin" });
    expect(env.COLLIE_POLL_MS).toBe("3000");
    expect(env.COLLIE_PACK_TIMEOUT_MS).toBe("2400");
  });

  test("stating neither leaves Collie's own defaults alone", () => {
    const env = collieChildEnv(fleetTestPackLeadConfig(), { PATH: "/usr/bin" });
    expect(env.COLLIE_POLL_MS).toBeUndefined();
    expect(env.COLLIE_PACK_TIMEOUT_MS).toBeUndefined();
  });

  test("an inherited value cannot decide how long a member has to answer", () => {
    // Reset before it is set, like every other key the configuration owns: a stray variable in the
    // environment must not be able to shorten the budget the operator wrote down.
    const inherited = { PATH: "/usr/bin", COLLIE_POLL_MS: "250", COLLIE_PACK_TIMEOUT_MS: "100" };
    expect(collieChildEnv(fleetTestPackLeadConfig(), inherited).COLLIE_POLL_MS).toBeUndefined();
    const stated = { ...fleetTestPackLeadConfig(), pack: { pollMs: 3000 } };
    expect(collieChildEnv(stated, inherited).COLLIE_POLL_MS).toBe("3000");
    expect(collieChildEnv(stated, inherited).COLLIE_PACK_TIMEOUT_MS).toBeUndefined();
  });
});
