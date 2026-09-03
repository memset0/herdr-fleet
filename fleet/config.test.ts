import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { loadFleetConfig, parseFleetToml, resolveFleetConfigPath } from "./config.ts";

const secret = Buffer.alloc(32, 7).toString("base64url");

function source(extra = ""): string {
  return `schema_version = 1
role = "lead"
${extra}
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
session_secret = "${secret}"
session_ttl_seconds = 86400
[auth.rate_limit]
max_failures = 5
aggregate_max_failures = 40
[proxy]
client_ip_header = "X-Forwarded-For"
`;
}

describe("fleet.toml", () => {
  test("parses one strict lead with distinct loopback endpoints", () => {
    const config = parseFleetToml(source());
    expect(config).toMatchObject({
      schemaVersion: 1,
      role: "lead",
      listen: { host: "127.0.0.1", port: 18787 },
      public: { origin: "https://fleet.example.com", host: "fleet.example.com" },
      collie: { host: "127.0.0.1", port: 8787 },
      proxy: { clientIpHeader: "X-Forwarded-For" },
    });
    expect(config.auth.rateLimit.aggregateMaxFailures).toBe(40);
  });

  test("rejects unknown and deferred multi-host fields", () => {
    expect(() => parseFleetToml(source('hosts = []'))).toThrow("unknown field hosts");
    expect(() => parseFleetToml(source().replace('role = "lead"', 'role = "peer"'))).toThrow(
      "role peer is not supported",
    );
    expect(() => parseFleetToml(`${source()}\n[transport]\ntype = "ssh-reverse"\n`)).toThrow(
      "unknown field transport",
    );
  });

  test("rejects unsafe origins, binds, secrets, work factors, and collisions", () => {
    expect(() => parseFleetToml(source().replace("https://fleet.example.com", "http://fleet.example.com"))).toThrow(
      "HTTPS origin",
    );
    expect(() => parseFleetToml(source().replace('host = "127.0.0.1"', 'host = "0.0.0.0"'))).toThrow(
      "loopback address",
    );
    expect(() => parseFleetToml(source().replace(secret, "short"))).toThrow("32 random base64url bytes");
    expect(() => parseFleetToml(source().replace("m=65536,t=3,p=1", "m=1024,t=1,p=1"))).toThrow(
      "approved work factors",
    );
    expect(() => parseFleetToml(source().replace("port = 18787", "port = 8787"))).toThrow("distinct loopback");
  });

  test("resolves only an absolute explicit or Herdr-provided path", () => {
    expect(resolveFleetConfigPath({ HERDR_FLEET_CONFIG: "/private/fleet.toml" })).toBe("/private/fleet.toml");
    expect(resolveFleetConfigPath({ HERDR_PLUGIN_CONFIG_DIR: "/private/plugin" })).toBe(
      "/private/plugin/fleet.toml",
    );
    expect(() => resolveFleetConfigPath({ HERDR_FLEET_CONFIG: "fleet.toml" })).toThrow("absolute path");
    expect(() => resolveFleetConfigPath({})).toThrow("is required");
  });

  test("loads only a regular owner-only file without echoing a secret", async () => {
    const root = await mkdtemp(join(tmpdir(), "herdr-fleet-config-"));
    const path = join(root, "fleet.toml");
    await writeFile(path, source(), { mode: 0o600 });
    expect((await loadFleetConfig(path)).role).toBe("lead");
    await chmod(path, 0o644);
    await expect(loadFleetConfig(path)).rejects.toThrow("chmod 600");
    await chmod(path, 0o600);
    await writeFile(path, source().replace(secret, "secret-that-must-not-appear"), { mode: 0o600 });
    await expect(loadFleetConfig(path)).rejects.not.toThrow("secret-that-must-not-appear");
  });
});
