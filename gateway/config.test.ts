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
    expect(config.fleetUi).toEqual({ iframeCacheSize: 1 });
    expect(config.nodes[0]?.transport).toEqual({ type: "local", url: "http://127.0.0.1:18788" });
  });

  test("accepts a bounded Fleet iframe cache size and rejects invalid Fleet UI settings", () => {
    const configured = rawGatewayConfig();
    configured.fleetUi = { iframeCacheSize: 5 };
    expect(parseGatewayConfig(configured).fleetUi.iframeCacheSize).toBe(5);

    for (const iframeCacheSize of [0, 11, 1.5, "5"]) {
      const invalid = rawGatewayConfig();
      invalid.fleetUi = { iframeCacheSize };
      expect(() => parseGatewayConfig(invalid)).toThrow("fleetUi.iframeCacheSize");
    }

    const unknown = rawGatewayConfig();
    unknown.fleetUi = { iframeCacheSize: 5, prioritizeAttention: true };
    expect(() => parseGatewayConfig(unknown)).toThrow("fleetUi contains unknown field");
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

  test("parses an optional central-only Discord notifier and forwards an opaque template selector", () => {
    const raw = rawGatewayConfig();
    raw.discordNotifications = {
      enabled: true,
      executable: "/opt/example/bin/pingme",
      channel: "test",
      template: "/opt/example/templates/fleet alert.md",
    };
    expect(parseGatewayConfig(raw).discordNotifications).toEqual({
      enabled: true,
      executable: "/opt/example/bin/pingme",
      channel: "test",
      template: "/opt/example/templates/fleet alert.md",
    });

    const disabled = rawGatewayConfig();
    disabled.discordNotifications = { enabled: false };
    expect(parseGatewayConfig(disabled).discordNotifications).toEqual({ enabled: false });
  });

  test("rejects incomplete or unsafe Discord notifier selectors", () => {
    const missing = rawGatewayConfig();
    missing.discordNotifications = { enabled: true, executable: "/opt/example/bin/pingme" };
    expect(() => parseGatewayConfig(missing)).toThrow("require executable and channel");

    const relative = rawGatewayConfig();
    relative.discordNotifications = { enabled: true, executable: "pingme", channel: "test" };
    expect(() => parseGatewayConfig(relative)).toThrow("must be absolute");

    const invalidChannel = rawGatewayConfig();
    invalidChannel.discordNotifications = {
      enabled: true,
      executable: "/opt/example/bin/pingme",
      channel: "--test-channel",
    };
    expect(() => parseGatewayConfig(invalidChannel)).toThrow("numeric id or configured alias");
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

  test("accepts a structured SSH jump endpoint and rejects ambiguous jump configuration", () => {
    const raw = rawGatewayConfig();
    nodes(raw)[0]!.transport = {
      type: "ssh",
      host: "cluster.example",
      user: "herdrweb",
      port: 22,
      identityFile: "/synthetic/keys/cluster",
      knownHostsFile: "/synthetic/known-hosts/cluster",
      localPort: 18789,
      remoteHost: "127.0.0.1",
      remotePort: 8787,
      jump: {
        host: "bastion.example",
        user: "gateway",
        port: 2222,
        identityFile: "/synthetic/keys/bastion",
        knownHostsFile: "/synthetic/known-hosts/bastion",
      },
    };
    const config = parseGatewayConfig(raw);
    const transport = config.nodes[0]?.transport;
    expect(transport?.type).toBe("ssh");
    if (transport?.type !== "ssh") throw new Error("expected SSH transport");
    expect(transport.jump).toEqual({
      host: "bastion.example",
      user: "gateway",
      port: 2222,
      identityFile: "/synthetic/keys/bastion",
      knownHostsFile: "/synthetic/known-hosts/bastion",
    });

    const unknownField = structuredClone(raw);
    const unknownJump = (nodes(unknownField)[0]!.transport as Record<string, unknown>).jump as Record<string, unknown>;
    unknownJump.agentForwarding = true;
    expect(() => parseGatewayConfig(unknownField)).toThrow("jump contains unknown field");

    const sharedPath = structuredClone(raw);
    const sharedTransport = nodes(sharedPath)[0]!.transport as Record<string, unknown>;
    (sharedTransport.jump as Record<string, unknown>).identityFile = sharedTransport.identityFile;
    expect(() => parseGatewayConfig(sharedPath)).toThrow("must differ from the target identity");
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

  test("requires an enabled Discord notifier path to be a real executable file", async () => {
    const root = await mkdtemp(join(tmpdir(), "web-remote-discord-config-test-"));
    temporary.push(root);
    const executable = join(root, "pingme");
    const path = join(root, "gateway.json");
    const raw = rawGatewayConfig();
    raw.discordNotifications = { enabled: true, executable, channel: "test" };
    await writeFile(path, JSON.stringify(raw), { mode: 0o600 });

    await expect(loadGatewayConfig(path)).rejects.toThrow("executable is unavailable");
    await writeFile(executable, "synthetic binary\n", { mode: 0o600 });
    await expect(loadGatewayConfig(path)).rejects.toThrow("regular executable file");
    await chmod(executable, 0o700);
    expect((await loadGatewayConfig(path)).discordNotifications).toMatchObject({ enabled: true, channel: "test" });
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

  test("requires a protected jump identity and rejects a copied target identity", async () => {
    const root = await mkdtemp(join(tmpdir(), "web-remote-jump-identity-test-"));
    temporary.push(root);
    const targetIdentity = join(root, "target-key");
    const jumpIdentity = join(root, "jump-key");
    const targetKnownHosts = join(root, "target-known-hosts");
    const jumpKnownHosts = join(root, "jump-known-hosts");
    await writeFile(targetIdentity, "synthetic-target-private-key\n", { mode: 0o600 });
    await writeFile(jumpIdentity, "synthetic-jump-private-key\n", { mode: 0o644 });
    await writeFile(targetKnownHosts, "cluster.example ssh-ed25519 synthetic-target\n", { mode: 0o644 });
    await writeFile(jumpKnownHosts, "bastion.example ssh-ed25519 synthetic-jump\n", { mode: 0o644 });

    const raw = rawGatewayConfig();
    nodes(raw)[0]!.transport = {
      type: "ssh",
      host: "cluster.example",
      user: "herdrweb",
      port: 22,
      identityFile: targetIdentity,
      knownHostsFile: targetKnownHosts,
      localPort: 18789,
      remoteHost: "127.0.0.1",
      remotePort: 8787,
      jump: {
        host: "bastion.example",
        user: "gateway",
        port: 22,
        identityFile: jumpIdentity,
        knownHostsFile: jumpKnownHosts,
      },
    };
    const path = join(root, "gateway.json");
    await writeFile(path, JSON.stringify(raw), { mode: 0o600 });

    await expect(loadGatewayConfig(path)).rejects.toThrow("SSH jump identity must not be accessible");
    await chmod(jumpIdentity, 0o600);
    expect((await loadGatewayConfig(path)).nodes[0]?.transport.type).toBe("ssh");

    await writeFile(jumpIdentity, "synthetic-target-private-key\n", { mode: 0o600 });
    await expect(loadGatewayConfig(path)).rejects.toThrow("SSH jump reuses its target private identity");
  });
});
