import { createConnection } from "node:net";
import { stat } from "node:fs/promises";

import type { FleetLoopbackEndpoint, FleetSchema2PeerConfig, FleetTransportConfig } from "./config.ts";

// The SSH underlay beneath native Pack. It carries TCP and nothing else: Collie's pinned mutual TLS
// and the Pack secret stay end to end inside the projections built here, and nothing in this module
// reads, derives, or asserts a member identity. A process that can bind a projection has proven only
// that it holds the SSH key the operator authorised for that one bind (PACK_PROTOCOL.md §8.2 —
// "Collie owns authentication; the operator owns reachability").

/** `[::1]:8787` for an IPv6 literal, `127.0.0.1:8787` otherwise — OpenSSH's forwarding grammar. */
function forwardEndpoint(endpoint: FleetLoopbackEndpoint): string {
  const host = endpoint.host.includes(":") ? `[${endpoint.host}]` : endpoint.host;
  return `${host}:${endpoint.port}`;
}

/**
 * The exact argument set for the one link.
 *
 * Every option here removes a capability the link must not have, and the list is pinned by a test
 * because each omission is a security property rather than a default worth trusting:
 *
 * - `-N -T` plus `RequestTTY=no` and `SessionType=none`: no remote command, no shell, no PTY.
 * - `-F /dev/null`: no inherited user configuration, so no host alias can add a forward, a proxy
 *   command, or an agent this argument set does not name. It is also why `ClearAllForwardings` is
 *   deliberately absent — it would clear the two forwards below rather than an inherited third.
 * - `ExitOnForwardFailure=yes`: a projection that cannot bind ends the attempt instead of leaving a
 *   link that is up in one direction and silently missing in the other.
 * - `StrictHostKeyChecking=yes` against the operator's own `UserKnownHostsFile`: the Lead is pinned,
 *   and an unknown or changed host key refuses rather than prompts.
 * - `IdentitiesOnly` + `IdentityAgent=none` + `ForwardAgent=no`: exactly the configured key, and no
 *   agent reaches the Lead.
 * - `ControlMaster=no` + `ControlPath=none`: no multiplexed session can ride this connection.
 */
export function sshLinkCommand(config: FleetSchema2PeerConfig): readonly string[] {
  const { transport, collie } = config;
  return [
    "ssh",
    "-N",
    "-T",
    "-F",
    "/dev/null",
    "-i",
    transport.identityFile,
    "-p",
    String(transport.sshPort),
    "-o",
    "BatchMode=yes",
    "-o",
    "RequestTTY=no",
    "-o",
    "SessionType=none",
    "-o",
    "ExitOnForwardFailure=yes",
    "-o",
    "StrictHostKeyChecking=yes",
    "-o",
    `UserKnownHostsFile=${transport.knownHostsFile}`,
    "-o",
    "IdentitiesOnly=yes",
    "-o",
    "IdentityAgent=none",
    "-o",
    "ForwardAgent=no",
    "-o",
    "ForwardX11=no",
    "-o",
    "ForwardX11Trusted=no",
    "-o",
    "ControlMaster=no",
    "-o",
    "ControlPath=none",
    "-o",
    "PermitLocalCommand=no",
    "-o",
    "ConnectTimeout=10",
    "-o",
    "ServerAliveInterval=15",
    "-o",
    "ServerAliveCountMax=3",
    // The Lead dials this Peer's own Collie endpoint at a Lead-local loopback address.
    "-R",
    `${forwardEndpoint(transport.leadBind)}:${forwardEndpoint(collie)}`,
    // This Peer reaches the Lead's Collie through the same connection.
    "-L",
    `${forwardEndpoint(transport.peerBind)}:${forwardEndpoint(transport.leadCollie)}`,
    `${transport.sshUser}@${transport.sshHost}`,
  ];
}

export type FileInfo = (path: string) => Promise<{ isFile: () => boolean; mode: number }>;

/**
 * Refuse to start a link whose key material anyone else can read.
 *
 * The check runs before the connection is attempted and names the field rather than the contents, so
 * a too-permissive key never reaches an argument list or a log line. `known_hosts` holds only public
 * host keys, so it is required to exist and be a regular file without a permission bound.
 */
export async function assertLinkFiles(
  transport: FleetTransportConfig,
  info: FileInfo = (path) => stat(path),
): Promise<void> {
  const checks = [
    { path: transport.identityFile, label: "transport.identity_file", ownerOnly: true },
    { path: transport.knownHostsFile, label: "transport.known_hosts_file", ownerOnly: false },
  ] as const;
  for (const check of checks) {
    let found: { isFile: () => boolean; mode: number };
    try {
      found = await info(check.path);
    } catch {
      throw new Error(`${check.label} is unavailable`);
    }
    if (!found.isFile()) throw new Error(`${check.label} must be a regular file`);
    if (check.ownerOnly && process.platform !== "win32" && (found.mode & 0o077) !== 0) {
      throw new Error(`${check.label} must not be accessible by group or other users (chmod 600)`);
    }
  }
}

export type EndpointProbe = (endpoint: FleetLoopbackEndpoint) => Promise<boolean>;

/**
 * Does something accept a connection at this loopback endpoint?
 *
 * A TCP connect and nothing more. The endpoint behind a projection answers Pack TLS, so sending a
 * request and reading the reply would be inferring a lifecycle stage from an application response
 * through a transparent tunnel — which is exactly the behaviour-probing the upstream contract rules
 * out. This proves the local projection is published; `ExitOnForwardFailure` proves the remote one.
 */
export async function probeEndpoint(
  endpoint: FleetLoopbackEndpoint,
  timeoutMs = 400,
): Promise<boolean> {
  return await new Promise((resolve) => {
    const socket = createConnection({ host: endpoint.host, port: endpoint.port });
    let settled = false;
    const done = (reachable: boolean): void => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(reachable);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}
