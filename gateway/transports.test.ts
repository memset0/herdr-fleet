import { afterEach, describe, expect, test } from "bun:test";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { SshTransportConfig } from "./config.ts";
import { TransportRegistry, jumpProxyCommand, reconnectDelayMs, sshArgs } from "./transports.ts";
import { gatewayConfig } from "./test-helpers.ts";

const temporary: string[] = [];
afterEach(async () => Promise.all(temporary.splice(0).map((path) => rm(path, { recursive: true, force: true }))));

function sshConfig(overrides: Partial<SshTransportConfig> = {}): SshTransportConfig {
  return {
    type: "ssh",
    host: "cluster.example",
    user: "herdrweb",
    port: 2222,
    identityFile: "/synthetic/id_ed25519",
    knownHostsFile: "/synthetic/known_hosts",
    localPort: 18789,
    remoteHost: "127.0.0.1",
    remotePort: 8787,
    ...overrides,
  };
}

describe("SSH transports", () => {
  test("constructs a pinned, dedicated, batch-only loopback forward", () => {
    const args = sshArgs(sshConfig());
    expect(args).toContain("-N");
    expect(args).toContain("-T");
    expect(args.slice(args.indexOf("-F"), args.indexOf("-F") + 2)).toEqual(["-F", "/dev/null"]);
    expect(args).toContain("BatchMode=yes");
    expect(args).toContain("ExitOnForwardFailure=yes");
    expect(args).toContain("StrictHostKeyChecking=yes");
    expect(args).toContain("UserKnownHostsFile=/synthetic/known_hosts");
    expect(args).toContain("UpdateHostKeys=no");
    expect(args).toContain("IdentitiesOnly=yes");
    expect(args).toContain("IdentityAgent=none");
    expect(args).toContain("PreferredAuthentications=publickey");
    expect(args).toContain("PasswordAuthentication=no");
    expect(args).toContain("KbdInteractiveAuthentication=no");
    expect(args).toContain("ForwardAgent=no");
    expect(args).toContain("ForwardX11=no");
    expect(args).toContain("ControlMaster=no");
    expect(args).toContain("ControlPath=none");
    expect(args).toContain("ControlPersist=no");
    expect(args).toContain("GatewayPorts=no");
    expect(args).toContain("Tunnel=no");
    expect(args.filter((arg) => arg === "-L")).toHaveLength(1);
    expect(args).not.toContain("-A");
    expect(args).not.toContain("-R");
    expect(args).not.toContain("-D");
    expect(args.some((arg) => arg.startsWith("ProxyCommand="))).toBe(false);
    expect(args).toContain("127.0.0.1:18789:127.0.0.1:8787");
    expect(args.slice(-2)).toEqual(["--", "cluster.example"]);
    expect(sshArgs(sshConfig({ remoteHost: "::1" }))).toContain("127.0.0.1:18789:[::1]:8787");
  });

  test("constructs a separately pinned, config-independent jump proxy", () => {
    const jump = {
      host: "bastion.example",
      user: "gateway",
      port: 2202,
      identityFile: "/synthetic/jump key'quoted",
      knownHostsFile: "/synthetic/jump-known-hosts",
    };
    const args = sshArgs(sshConfig({ jump }));
    const proxyOptions = args.filter((arg) => arg.startsWith("ProxyCommand="));
    expect(proxyOptions).toHaveLength(1);
    const proxy = jumpProxyCommand(jump);
    expect(proxyOptions[0]).toBe(`ProxyCommand=${proxy}`);
    expect(proxy).toContain("'/usr/bin/ssh' '-T' '-F' '/dev/null'");
    expect(proxy).toContain("'StrictHostKeyChecking=yes'");
    expect(proxy).toContain("'UserKnownHostsFile=/synthetic/jump-known-hosts'");
    expect(proxy).toContain("'IdentityAgent=none'");
    expect(proxy).toContain("'-i' '/synthetic/jump key'\\''quoted'");
    expect(proxy).toContain("'-W' '%h:%p' '--' 'bastion.example'");
    expect(args).toContain("UserKnownHostsFile=/synthetic/known_hosts");
    expect(args).toContain("/synthetic/id_ed25519");
    expect(args.filter((arg) => arg === "-L")).toHaveLength(1);
    expect(args.slice(-2)).toEqual(["--", "cluster.example"]);
  });

  test("uses capped exponential reconnect delays", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 20].map(reconnectDelayMs)).toEqual([
      1_000,
      2_000,
      4_000,
      8_000,
      16_000,
      30_000,
      30_000,
      30_000,
    ]);
  });

  test("stays starting until the loopback forward is actually ready", async () => {
    const root = await mkdtemp(join(tmpdir(), "web-remote-ssh-readiness-test-"));
    temporary.push(root);
    const longLived = join(root, "ssh-long-lived");
    await writeFile(longLived, "#!/usr/bin/env bun\nsetInterval(() => {}, 1_000);\n");
    await chmod(longLived, 0o700);
    const local = gatewayConfig().nodes[0]!;
    const remote = { ...local, id: "remote", publicHost: "remote.example.com", transport: sshConfig() };
    let ready = false;
    const registry = new TransportRegistry([local, remote], longLived, async () => ready);
    registry.start();
    await Bun.sleep(1_100);
    expect(registry.status(remote).state).toBe("starting");
    expect(registry.status(remote).message).toBe("connecting");
    ready = true;
    await Bun.sleep(150);
    expect(registry.status(remote).state).toBe("up");
    expect(registry.status(remote).message).toBeNull();
    registry.stop();
  });

  test("keeps a failed SSH node down while local nodes remain available", async () => {
    const root = await mkdtemp(join(tmpdir(), "web-remote-ssh-test-"));
    temporary.push(root);
    const failing = join(root, "ssh-fail");
    await writeFile(failing, "#!/usr/bin/env bash\necho synthetic failure >&2\nexit 23\n");
    await chmod(failing, 0o700);
    const local = gatewayConfig().nodes[0]!;
    const remote = { ...local, id: "remote", publicHost: "remote.example.com", transport: sshConfig() };
    const registry = new TransportRegistry([local, remote], failing, async () => false);
    registry.start();
    await Bun.sleep(100);
    expect(registry.status(local).state).toBe("up");
    expect(registry.status(remote).state).toBe("down");
    expect(registry.status(remote).message).toContain("synthetic failure");
    registry.stop();
  });
});
