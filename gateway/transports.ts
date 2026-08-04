import { spawn, type ChildProcess } from "node:child_process";

import type { NodeConfig, SshTransportConfig } from "./config.ts";
import { upstreamFor } from "./config.ts";

export interface TransportStatus {
  kind: "local" | "ssh";
  state: "up" | "starting" | "down";
  pid: number | null;
  message: string | null;
}

export function sshArgs(config: SshTransportConfig): string[] {
  const remoteHost = config.remoteHost === "::1" ? "[::1]" : config.remoteHost;
  const forward = `127.0.0.1:${config.localPort}:${remoteHost}:${config.remotePort}`;
  return [
    "-N",
    "-T",
    "-o", "BatchMode=yes",
    "-o", "ExitOnForwardFailure=yes",
    "-o", "StrictHostKeyChecking=yes",
    "-o", `UserKnownHostsFile=${config.knownHostsFile}`,
    "-o", "GlobalKnownHostsFile=/dev/null",
    "-o", "IdentitiesOnly=yes",
    "-o", "ForwardAgent=no",
    "-o", "ForwardX11=no",
    "-o", "PermitLocalCommand=no",
    "-o", "ServerAliveInterval=15",
    "-o", "ServerAliveCountMax=3",
    "-o", "ConnectTimeout=10",
    "-i", config.identityFile,
    "-p", String(config.port),
    "-l", config.user,
    "-L", forward,
    "--",
    config.host,
  ];
}

class SshTunnel {
  private child: ChildProcess | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;
  private stopped = false;
  private message: string | null = null;

  constructor(
    private readonly config: SshTransportConfig,
    private readonly sshBinary = "/usr/bin/ssh",
  ) {}

  start(): void {
    if (this.child || this.timer || this.stopped) return;
    this.message = "connecting";
    const child = spawn(this.sshBinary, sshArgs(this.config), { stdio: ["ignore", "ignore", "pipe"] });
    this.child = child;
    let stderr = "";
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string) => {
      stderr = `${stderr}${chunk}`.slice(-2_000);
    });
    child.once("error", (error) => {
      this.message = error.message;
    });
    child.once("close", (code, signal) => {
      this.child = null;
      if (this.stopped) return;
      this.message = stderr.trim() || `ssh exited (${signal ?? code ?? "unknown"})`;
      const delay = Math.min(30_000, 1_000 * 2 ** Math.min(this.attempts, 5));
      this.attempts += 1;
      this.timer = setTimeout(() => {
        this.timer = null;
        this.start();
      }, delay);
    });
    setTimeout(() => {
      if (this.child === child && child.exitCode === null) {
        this.attempts = 0;
        this.message = null;
      }
    }, 1_000);
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.child?.kill("SIGTERM");
    this.child = null;
  }

  status(): TransportStatus {
    if (this.child?.exitCode === null) {
      return {
        kind: "ssh",
        state: this.message === "connecting" ? "starting" : "up",
        pid: this.child.pid ?? null,
        message: this.message,
      };
    }
    return { kind: "ssh", state: this.timer ? "down" : "starting", pid: null, message: this.message };
  }
}

export class TransportRegistry {
  private readonly tunnels = new Map<string, SshTunnel>();

  constructor(
    nodes: NodeConfig[],
    sshBinary = "/usr/bin/ssh",
  ) {
    for (const node of nodes) {
      if (node.enabled && node.transport.type === "ssh") {
        this.tunnels.set(node.id, new SshTunnel(node.transport, sshBinary));
      }
    }
  }

  start(): void {
    for (const tunnel of this.tunnels.values()) tunnel.start();
  }

  stop(): void {
    for (const tunnel of this.tunnels.values()) tunnel.stop();
  }

  status(node: NodeConfig): TransportStatus {
    if (node.transport.type === "local") return { kind: "local", state: "up", pid: null, message: null };
    return this.tunnels.get(node.id)?.status() ?? { kind: "ssh", state: "down", pid: null, message: "tunnel disabled" };
  }

  upstream(node: NodeConfig): string {
    return upstreamFor(node);
  }
}
