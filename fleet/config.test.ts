import { readFileSync } from "node:fs";
import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, test } from "bun:test";

import {
  loadFleetConfig,
  parseFleetToml,
  resolveFleetConfigPath,
  type FleetTransportConfig,
} from "./config.ts";

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

function packLeadSource(extra = ""): string {
  return source(extra)
    .replace("schema_version = 1", "schema_version = 2")
    .replace(`role = "lead"`, `role = "lead"
[lifecycle]
mode = "native-pack"
pack_state = "collie"`);
}

const transportTable = `[transport]
mode = "ssh-reverse"
ssh_host = "lead.example.com"
ssh_port = 22
ssh_user = "fleet-tunnel"
identity_file = "/synthetic/fleet/id_ed25519"
known_hosts_file = "/synthetic/fleet/known_hosts"
lead_bind_host = "127.0.0.1"
lead_bind_port = 18901
peer_bind_host = "127.0.0.1"
peer_bind_port = 18902
lead_collie_host = "127.0.0.1"
lead_collie_port = 8787
retry_max_seconds = 60
`;

const transport: FleetTransportConfig = {
  mode: "ssh-reverse",
  sshHost: "lead.example.com",
  sshPort: 22,
  sshUser: "fleet-tunnel",
  identityFile: "/synthetic/fleet/id_ed25519",
  knownHostsFile: "/synthetic/fleet/known_hosts",
  leadBind: { host: "127.0.0.1", port: 18_901 },
  peerBind: { host: "127.0.0.1", port: 18_902 },
  leadCollie: { host: "127.0.0.1", port: 8787 },
  retryMaxSeconds: 60,
};

function packPeerSource(extra = "", transportBlock = transportTable): string {
  return `schema_version = 2
role = "peer"
${extra}
[lifecycle]
mode = "native-pack"
pack_state = "collie"
[collie]
host = "127.0.0.1"
port = 8787
${transportBlock}`;
}

/** The peer source with one `[transport]` field replaced, for the per-field rejection tests. */
function peerTransport(field: string, value: string): string {
  const line = new RegExp(`^${field} = .*$`, "m");
  const block = transportTable.replace(line, `${field} = ${value}`);
  if (block === transportTable) throw new Error(`transport.${field} is not in the fixture`);
  return packPeerSource("", block);
}

describe("fleet.toml", () => {
  test("parses one strict lead with distinct loopback endpoints", () => {
    const config = parseFleetToml(source());
    expect(config).toEqual({
      schemaVersion: 1,
      role: "lead",
      listen: { host: "127.0.0.1", port: 18787 },
      public: { origin: "https://fleet.example.com", host: "fleet.example.com" },
      collie: { host: "127.0.0.1", port: 8787 },
      auth: {
        username: "operator",
        passwordHash: "$argon2id$v=19$m=65536,t=3,p=1$c2FsdA$aGFzaA",
        sessionSecret: secret,
        sessionTtlSeconds: 86_400,
        rateLimit: {
          maxFailures: 5,
          windowSeconds: 600,
          blockSeconds: 900,
          maxSources: 10_000,
          aggregateMaxFailures: 40,
          aggregateWindowSeconds: 60,
          aggregateBlockSeconds: 60,
        },
      },
      proxy: { clientIpHeader: "X-Forwarded-For" },
    });
  });

  test("parses strict native Pack lead and peer branches", () => {
    expect(parseFleetToml(packLeadSource())).toMatchObject({
      schemaVersion: 2,
      role: "lead",
      lifecycle: { mode: "native-pack", packState: "collie" },
      listen: { host: "127.0.0.1", port: 18787 },
      public: { origin: "https://fleet.example.com" },
      collie: { host: "127.0.0.1", port: 8787 },
      auth: { username: "operator" },
    });
    expect(parseFleetToml(packPeerSource())).toEqual({
      schemaVersion: 2,
      role: "peer",
      lifecycle: { mode: "native-pack", packState: "collie" },
      collie: { host: "127.0.0.1", port: 8787 },
      transport,
    });
  });

  test("a lead's reachability list is optional, loopback-only and free of trust material", () => {
    expect(parseFleetToml(packLeadSource())).toMatchObject({ role: "lead", reachability: [] });
    const mapped = `[[reachability]]
member_id = "peer-a"
host = "127.0.0.1"
port = 18901

[[reachability]]
member_id = "peer-b"
host = "::1"
port = 18902
`;
    expect(parseFleetToml(`${packLeadSource()}${mapped}`)).toMatchObject({
      reachability: [
        { memberId: "peer-a", host: "127.0.0.1", port: 18_901 },
        { memberId: "peer-b", host: "::1", port: 18_902 },
      ],
    });

    const one = (body: string) => `${packLeadSource()}[[reachability]]\n${body}`;
    expect(() => parseFleetToml(one(`member_id = "Peer A"\nhost = "127.0.0.1"\nport = 18901\n`))).toThrow(
      "reachability[0].member_id must be a Pack member id",
    );
    expect(() => parseFleetToml(one(`member_id = "peer-a"\nhost = "0.0.0.0"\nport = 18901\n`))).toThrow(
      "reachability[0].host must be a loopback address",
    );
    for (const field of ["certificate", "fingerprint", "pack_secret", "key", "user", "command"]) {
      expect(() =>
        parseFleetToml(one(`member_id = "peer-a"\nhost = "127.0.0.1"\nport = 18901\n${field} = "x"\n`)),
      ).toThrow(`reachability[0] contains unknown field ${field}`);
    }
    expect(() =>
      parseFleetToml(
        `${packLeadSource()}[[reachability]]\nmember_id = "peer-a"\nhost = "127.0.0.1"\nport = 18901\n` +
          `[[reachability]]\nmember_id = "peer-a"\nhost = "127.0.0.1"\nport = 18902\n`,
      ),
    ).toThrow("reachability[1].member_id is already mapped");
    expect(() =>
      parseFleetToml(
        `${packLeadSource()}[[reachability]]\nmember_id = "peer-a"\nhost = "127.0.0.1"\nport = 18901\n` +
          `[[reachability]]\nmember_id = "peer-b"\nhost = "127.0.0.1"\nport = 18901\n`,
      ),
    ).toThrow("reachability[1] reuses an endpoint already mapped to another member");
    expect(() => parseFleetToml(packLeadSource().replace("[lifecycle]", `${transportTable}[lifecycle]`))).toThrow(
      "unknown field transport",
    );
  });

  test("the documented synthetic examples parse and carry no live value", () => {
    const doc = readFileSync(resolve(import.meta.dir, "..", "docs", "herdr-fleet.md"), "utf8");
    const blocks = [...doc.matchAll(/```toml\n([\s\S]*?)```/g)].map((match) => match[1] ?? "");
    const transportBlock = blocks.find((block) => block.includes("[transport]"));
    const reachabilityBlock = blocks.find((block) => block.includes("[[reachability]]"));
    const sharedBlock = blocks.find((block) => block.includes("[lifecycle]"));
    if (
      transportBlock === undefined ||
      reachabilityBlock === undefined ||
      sharedBlock === undefined
    ) {
      throw new Error("the documented schema-2 examples are missing");
    }

    // The documented peer is the shared block with its role fixed plus the documented transport.
    const peer = parseFleetToml(
      `${sharedBlock.replace(`role = "peer" # or "lead"`, `role = "peer"`)}${transportBlock}`,
    );
    expect(peer).toMatchObject({ role: "peer", transport: { mode: "ssh-reverse" } });
    expect(parseFleetToml(`${packLeadSource()}${reachabilityBlock}`)).toMatchObject({
      reachability: [{ memberId: "peer-a" }],
    });

    // Synthetic throughout. The shapes are asserted rather than a deny-list of real values, because
    // a deny-list would have to name the very identifiers this repository must not carry.
    expect(transportBlock).toMatch(/^ssh_host = "[a-z0-9-]+\.example\.com"$/m);
    expect(transportBlock).toMatch(/^identity_file = "\/private\/[^"]+"$/m);
    expect(transportBlock).toMatch(/^known_hosts_file = "\/private\/[^"]+"$/m);
    for (const block of [transportBlock, reachabilityBlock]) {
      for (const [, host] of block.matchAll(/^\w*host = "([^"]*)"$/gm)) {
        if (host === undefined || host.endsWith(".example.com")) continue;
        expect(["127.0.0.1", "::1"]).toContain(host);
      }
    }
  });

  test("a peer's transport admits one mode, loopback projections and no trust material", () => {
    expect(() => parseFleetToml(peerTransport("mode", '"ssh-forward"'))).toThrow(
      "transport.mode must be ssh-reverse",
    );
    for (const [field, value, message] of [
      ["lead_bind_host", '"0.0.0.0"', "transport.lead_bind_host must be a loopback address"],
      ["peer_bind_host", '""', "transport.peer_bind_host must be a non-empty string"],
      ["peer_bind_host", '"::"', "transport.peer_bind_host must be a loopback address"],
      ["lead_collie_host", '"203.0.113.1"', "transport.lead_collie_host must be a loopback address"],
      ["identity_file", '"relative/id"', "transport.identity_file must be an absolute path"],
      ["known_hosts_file", '"hosts"', "transport.known_hosts_file must be an absolute path"],
      ["ssh_user", '"root user"', "transport.ssh_user must be 1 to 64 safe characters"],
      ["ssh_host", '"https://lead"', "transport.ssh_host must be a hostname or address"],
      ["retry_max_seconds", "0", "transport.retry_max_seconds must be an integer between 1 and 3600"],
    ] as const) {
      expect(() => parseFleetToml(peerTransport(field, value))).toThrow(message);
    }

    // Both lead-side endpoints share a machine, and both peer-side endpoints share this one.
    expect(() => parseFleetToml(peerTransport("lead_collie_port", "18901"))).toThrow(
      "transport.lead_bind and transport.lead_collie must use distinct endpoints",
    );
    expect(() => parseFleetToml(peerTransport("peer_bind_port", "8787"))).toThrow(
      "transport.peer_bind and collie must use distinct endpoints",
    );

    for (const field of ["member_id", "pack_secret", "certificate", "password", "remote_command"]) {
      expect(() => parseFleetToml(packPeerSource().replace("retry_max_seconds = 60", `${field} = "x"`))).toThrow(
        `transport contains unknown field ${field}`,
      );
    }
    expect(() =>
      parseFleetToml(`${packPeerSource()}[[reachability]]\nmember_id = "peer-a"\nhost = "127.0.0.1"\nport = 18901\n`),
    ).toThrow("unknown field reachability");
    expect(() => parseFleetToml(packPeerSource("", ""))).toThrow(
      "transport must be a table",
    );
  });

  test("rejects unknown and deferred multi-host fields", () => {
    expect(() => parseFleetToml(source('hosts = []'))).toThrow("unknown field hosts");
    expect(() => parseFleetToml(source().replace('role = "lead"', 'role = "peer"'))).toThrow(
      "role peer is not supported",
    );
    expect(() => parseFleetToml(`${source()}\n[transport]\ntype = "ssh-reverse"\n`)).toThrow(
      "unknown field transport",
    );
    for (const field of [
      "hosts = []",
      'ssh = "route"',
      'address = "peer"',
      'endpoint = "loopback-ref"',
      'key = "private"',
      'command = "connect"',
      'member = "peer-a"',
      'pack_secret = "secret"',
      'certificate = "pem"',
    ]) {
      expect(() => parseFleetToml(packPeerSource(field))).toThrow(`unknown field ${field.split(" ")[0]}`);
    }
    expect(() => parseFleetToml(`${packPeerSource()}[auth]\nusername = "operator"\n`)).toThrow(
      "unknown field auth",
    );
    expect(() => parseFleetToml(`${packPeerSource()}[listen]\nhost = "127.0.0.1"\nport = 18787\n`)).toThrow(
      "unknown field listen",
    );
    expect(() => parseFleetToml(`${packPeerSource()}[public]\norigin = "https://fleet.example.com"\n`)).toThrow(
      "unknown field public",
    );
    expect(() => parseFleetToml(`${packPeerSource()}[proxy]\nclient_ip_header = "X-Forwarded-For"\n`)).toThrow(
      "unknown field proxy",
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

  test("rejects unsupported schema 2 lifecycle and role choices without echoing values", () => {
    expect(() => parseFleetToml(packPeerSource().replace('mode = "native-pack"', 'mode = "other"'))).toThrow(
      "lifecycle.mode must be native-pack",
    );
    expect(() => parseFleetToml(packPeerSource().replace('pack_state = "collie"', 'pack_state = "other"'))).toThrow(
      "lifecycle.pack_state must be collie",
    );
    expect(() => parseFleetToml(packPeerSource().replace('role = "peer"', 'role = "deputy"'))).toThrow(
      "role must be lead or peer",
    );
    expect(() => parseFleetToml(packPeerSource().replace("schema_version = 2", "schema_version = 3"))).toThrow(
      "schema_version must be 1 or 2",
    );
    expect(() => parseFleetToml(packPeerSource('session_secret = "must-not-appear"'))).not.toThrow(
      "must-not-appear",
    );
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
