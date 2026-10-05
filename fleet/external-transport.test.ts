import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, test } from "bun:test";

import { peerStore } from "../bridge/crew/fixtures.ts";
import { serializeTrustStore, TRUST_STORE_FILENAME } from "../bridge/crew/trust-store.ts";
import { parseFleetToml } from "./config.ts";
import { formatStatus } from "./control.ts";
import { validatePackAuthority } from "./pack-authority.ts";
import { probeEndpoint, sshLinkCommand } from "./pack-reachability.ts";
import { parseControlResponse, sendControl } from "./protocol.ts";
import { childSpecs, resolveRuntimePaths } from "./runtime.ts";

function source(colliePort = 18_900, projectionPort = 18_902): string {
  return `schema_version = 2
role = "peer"
[lifecycle]
mode = "native-pack"
pack_state = "collie"
[collie]
host = "127.0.0.1"
port = ${colliePort}
[transport]
mode = "external"
peer_bind_host = "127.0.0.1"
peer_bind_port = ${projectionPort}
`;
}

const terminal = `[terminal]
bind_host = "127.0.0.1"
bind_port = 18903
lead_bind_host = "127.0.0.1"
lead_bind_port = 18911
server_path = "/synthetic/fleet/bin/terminal-server"
server_digest = "${"0".repeat(64)}"
`;

function freePort(): number {
  const listener = Bun.listen({ hostname: "127.0.0.1", port: 0, socket: { data() {} } });
  const port = listener.port;
  listener.stop(true);
  return port;
}

describe("Operator-owned peer transport", () => {
  test("accepts only the explicit loopback projection and refuses SSH fields", () => {
    const config = parseFleetToml(source());
    expect(config).toMatchObject({ role: "peer", transport: { mode: "external", peerBind: { host: "127.0.0.1", port: 18_902 } } });
    for (const field of ["ssh_host", "ssh_port", "ssh_user", "identity_file", "known_hosts_file", "retry_max_seconds", "command"]) {
      expect(() => parseFleetToml(source() + `${field} = "unused"\n`)).toThrow(`transport contains unknown field ${field}`);
    }
    expect(() => parseFleetToml(source().replace('peer_bind_host = "127.0.0.1"', 'peer_bind_host = "0.0.0.0"'))).toThrow("transport.peer_bind_host");
    expect(() => parseFleetToml(source().replace("peer_bind_port = 18902", "peer_bind_port = 0"))).toThrow("transport.peer_bind_port");
    expect(() => parseFleetToml(source().replace("peer_bind_port = 18902\n", ""))).toThrow("transport.peer_bind_port");
    expect(() => parseFleetToml(source(18_900, 18_900))).toThrow("must use distinct endpoints");
    expect(() => parseFleetToml(source() + terminal.replace("bind_port = 18903", "bind_port = 18902"))).toThrow("terminal.bind and transport.peer_bind");
  });

  test("keeps authority and terminal isolation while omitting the SSH child", async () => {
    const paths = resolveRuntimePaths({ HERDR_PLUGIN_ROOT: resolve(import.meta.dir, ".."), HERDR_FLEET_CONFIG: "/synthetic/config/fleet.toml", HERDR_PLUGIN_STATE_DIR: "/synthetic/state", XDG_RUNTIME_DIR: "/synthetic/runtime", HERDR_FLEET_GENERATION: "external-test" });
    for (const declaration of ["", terminal]) {
      const config = parseFleetToml(source() + declaration);
      if (config.role !== "peer") throw new Error("fixture must be a peer");
      const children = childSpecs(config, paths, { PATH: "" });
      expect(children.map((child) => child.name)).toEqual(declaration === "" ? ["collie"] : ["collie", "terminal"]);
      expect(children.some((child) => child.command[0] === "ssh")).toBe(false);
      expect(() => sshLinkCommand(config)).toThrow("external transport has no SSH command");
      const trust = peerStore();
      const before = serializeTrustStore(trust);
      await expect(validatePackAuthority(config, "/unused", async () => trust)).resolves.toBeUndefined();
      expect(serializeTrustStore(trust)).toBe(before);
      await expect(validatePackAuthority(config, "/unused", async () => null)).rejects.toThrow("unavailable or invalid");
    }
  });

  test("reports external ownership without synthesizing a link or connectivity", () => {
    const response = parseControlResponse(JSON.stringify({ status: "running", generation: "external-test", role: "peer", transport: "external", pid: 7, startedAt: 1, children: [{ name: "collie", pid: 8, running: true, restarts: 0, nextRestartAt: null }] }));
    expect(response).not.toBeNull();
    if (response === null) throw new Error("fixture response failed validation");
    expect(formatStatus(response)).toBe("herdr-fleet: supervisor running generation=external-test role=peer transport=external pid=7 collie=running(pid=8)");
    for (const transport of ["ssh", "unknown", null]) {
      expect(parseControlResponse(JSON.stringify({ ...response, transport }))).toBeNull();
    }
    expect(parseControlResponse(JSON.stringify({ ...response, role: "lead" }))).toBeNull();
  });

  test("starts and stops the ordinary daemon while the external projection is absent", async () => {
    const root = await mkdtemp(join(tmpdir(), "fleet-external-lifecycle-"));
    let daemon: ReturnType<typeof Bun.spawn> | undefined;
    const generation = `external-${process.pid}`;
    let paths: ReturnType<typeof resolveRuntimePaths> | undefined;
    try {
      const colliePort = freePort();
      let projectionPort = freePort();
      while (projectionPort === colliePort) projectionPort = freePort();
      expect(await probeEndpoint({ host: "127.0.0.1", port: projectionPort })).toBe(false);
      await mkdir(join(root, "bin"));
      await mkdir(join(root, "state", "collie"), { recursive: true, mode: 0o700 });
      const config = join(root, "fleet.toml");
      await writeFile(config, source(colliePort, projectionPort), { mode: 0o600 });
      await writeFile(join(root, "state", "collie", TRUST_STORE_FILENAME), serializeTrustStore(peerStore()), { mode: 0o600 });
      const binary = join(root, "bin", "collie");
      await writeFile(binary, `#!${process.execPath}\nBun.listen({ hostname: process.env.COLLIE_HOST, port: Number(process.env.COLLIE_PORT), socket: { data() {} } });\n`, { mode: 0o700 });
      await chmod(binary, 0o700);
      const environment = { ...process.env, HOME: root, PATH: "", HERDR_PLUGIN_ROOT: root, HERDR_PLUGIN_STATE_DIR: join(root, "state"), HERDR_FLEET_CONFIG: config, XDG_RUNTIME_DIR: join(root, "runtime"), HERDR_FLEET_GENERATION: generation };
      paths = resolveRuntimePaths(environment);
      daemon = Bun.spawn([process.execPath, "run", join(import.meta.dir, "daemon.ts")], { env: environment, stdout: "pipe", stderr: "pipe" });
      let ready = false;
      const deadline = Date.now() + 10_000;
      while (Date.now() < deadline && !ready) {
        try {
          const response = await sendControl(paths.socketPath, { operation: "status", generation }, 500);
          if (response.status === "running") {
            expect(response.transport).toBe("external");
            expect(response.children.map((child) => child.name)).toEqual(["collie"]);
            ready = true;
          }
        } catch {
          // The daemon publishes its control socket before the child becomes ready.
        }
        if (!ready) await Bun.sleep(25);
      }
      if (!ready) throw new Error("external daemon did not become locally ready");
      expect(await probeEndpoint({ host: "127.0.0.1", port: projectionPort })).toBe(false);
      await sendControl(paths.socketPath, { operation: "stop", generation });
      expect(await daemon.exited).toBe(0);
      expect(await probeEndpoint({ host: "127.0.0.1", port: colliePort })).toBe(false);
    } finally {
      if (daemon !== undefined && daemon.exitCode === null) {
        daemon.kill("SIGTERM");
        await daemon.exited;
      }
      await rm(root, { recursive: true, force: true });
    }
  }, 20_000);
});
