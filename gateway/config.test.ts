import { afterEach, describe, expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadGatewayConfig, parseGatewayConfig } from "./config.ts";
import { rawGatewayConfig } from "./test-helpers.ts";

const temporary: string[] = [];
afterEach(async () => Promise.all(temporary.splice(0).map((path) => rm(path, { recursive: true, force: true }))));

function nodes(raw: Record<string, unknown>): Array<Record<string, unknown>> {
  return raw.nodes as Array<Record<string, unknown>>;
}

describe("gateway configuration", () => {
  test("accepts an exact loopback local inventory", () => {
    const config = parseGatewayConfig(rawGatewayConfig());
    expect(config.public.fleetHost).toBe("fleet.example.com");
    expect(config.nodes[0]?.transport).toEqual({ type: "local", url: "http://127.0.0.1:18788" });
  });

  test("rejects unknown fields, non-boolean enablement, non-loopback URLs, and disabled-only inventory", () => {
    const extra = rawGatewayConfig();
    extra.typo = true;
    expect(() => parseGatewayConfig(extra)).toThrow("unknown field");

    const enabled = rawGatewayConfig();
    nodes(enabled)[0]!.enabled = "false";
    expect(() => parseGatewayConfig(enabled)).toThrow("must be a boolean");

    const publicUrl = rawGatewayConfig();
    nodes(publicUrl)[0]!.transport = { type: "local", url: "http://192.0.2.10:8787" };
    expect(() => parseGatewayConfig(publicUrl)).toThrow("loopback");

    const disabled = rawGatewayConfig();
    nodes(disabled)[0]!.enabled = false;
    expect(() => parseGatewayConfig(disabled)).toThrow("enabled instance");
  });

  test("rejects duplicate routes and local listener collisions", () => {
    const duplicateHost = rawGatewayConfig();
    nodes(duplicateHost).push({
      ...nodes(duplicateHost)[0],
      id: "other",
    });
    expect(() => parseGatewayConfig(duplicateHost)).toThrow("duplicate public host");

    const listenerCollision = rawGatewayConfig();
    nodes(listenerCollision)[0]!.transport = { type: "local", url: "http://127.0.0.1:18787" };
    expect(() => parseGatewayConfig(listenerCollision)).toThrow("duplicate local listener port");
  });

  test("rejects a private SSH identity path reused by another node", () => {
    const raw = rawGatewayConfig();
    const remote = {
      id: "cluster-a",
      name: "Cluster A",
      publicHost: "cluster-a.example.com",
      enabled: true,
      labels: ["remote"],
      transport: {
        type: "ssh",
        host: "cluster-a.example",
        user: "herdrweb",
        port: 22,
        identityFile: "/synthetic/keys/cluster-a",
        knownHostsFile: "/synthetic/known_hosts",
        localPort: 18789,
        remoteHost: "127.0.0.1",
        remotePort: 8787,
      },
    };
    nodes(raw)[0] = remote;
    nodes(raw).push({
      ...remote,
      id: "cluster-b",
      name: "Cluster B",
      publicHost: "cluster-b.example.com",
      transport: { ...remote.transport, host: "cluster-b.example", localPort: 18790 },
    });
    expect(() => parseGatewayConfig(raw)).toThrow("duplicate SSH identity path");
  });

  test("requires protected config and SSH identity files", async () => {
    const root = await mkdtemp(join(tmpdir(), "web-remote-config-test-"));
    temporary.push(root);
    await mkdir(join(root, "ssh"), { mode: 0o700 });
    const identity = join(root, "ssh", "identity");
    const knownHosts = join(root, "ssh", "known_hosts");
    await writeFile(identity, "synthetic-private-key\n", { mode: 0o644 });
    await writeFile(knownHosts, "cluster.example ssh-ed25519 synthetic\n", { mode: 0o644 });
    const raw = rawGatewayConfig();
    nodes(raw)[0]!.transport = {
      type: "ssh",
      host: "cluster.example",
      user: "herdrweb",
      port: 22,
      identityFile: identity,
      knownHostsFile: knownHosts,
      localPort: 18789,
      remoteHost: "127.0.0.1",
      remotePort: 8787,
    };
    const path = join(root, "gateway.json");
    await writeFile(path, JSON.stringify(raw), { mode: 0o644 });
    await chmod(path, 0o644);
    await chmod(identity, 0o644);
    await expect(loadGatewayConfig(path)).rejects.toThrow("gateway config must not be accessible");
    await chmod(path, 0o600);
    await expect(loadGatewayConfig(path)).rejects.toThrow("SSH identity must not be accessible");
    await chmod(identity, 0o600);
    expect((await loadGatewayConfig(path)).nodes[0]?.transport.type).toBe("ssh");
  });

  test("rejects copied SSH private identities even when their paths differ", async () => {
    const root = await mkdtemp(join(tmpdir(), "web-remote-config-identity-test-"));
    temporary.push(root);
    const identityA = join(root, "cluster-a-key");
    const identityB = join(root, "cluster-b-key");
    const knownHosts = join(root, "known_hosts");
    await writeFile(identityA, "synthetic-private-key-a\n", { mode: 0o600 });
    await writeFile(identityB, "synthetic-private-key-a\n", { mode: 0o600 });
    await writeFile(knownHosts, "cluster.example ssh-ed25519 synthetic\n", { mode: 0o644 });

    const raw = rawGatewayConfig();
    const transport = {
      type: "ssh",
      host: "cluster-a.example",
      user: "herdrweb",
      port: 22,
      identityFile: identityA,
      knownHostsFile: knownHosts,
      localPort: 18789,
      remoteHost: "127.0.0.1",
      remotePort: 8787,
    };
    nodes(raw)[0] = {
      id: "cluster-a",
      name: "Cluster A",
      publicHost: "cluster-a.example.com",
      enabled: true,
      labels: ["remote"],
      transport,
    };
    nodes(raw).push({
      id: "cluster-b",
      name: "Cluster B",
      publicHost: "cluster-b.example.com",
      enabled: true,
      labels: ["remote"],
      transport: { ...transport, host: "cluster-b.example", identityFile: identityB, localPort: 18790 },
    });
    const path = join(root, "gateway.json");
    await writeFile(path, JSON.stringify(raw), { mode: 0o600 });

    await expect(loadGatewayConfig(path)).rejects.toThrow("reuses the SSH private identity");
  });
});
