import { spawn, type ChildProcess } from "node:child_process";
import { createConnection } from "node:net";

import type { NodeConfig, SshJumpConfig, SshTransportConfig } from "./config.ts";
import { upstreamFor } from "./config.ts";

export interface TransportStatus {
  kind: "local" | "ssh";
  state: "up" | "starting" | "down";
  pid: number | null;
  message: string | null;
}

export type ForwardProbe = (port: number) => Promise<boolean>;

function shellWord(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

export function jumpProxyCommand(config: SshJumpConfig): string {
  const args = [
    "/usr/bin/ssh",
    "-T",
    "-F", "/dev/null",
    "-o", "BatchMode=yes",
    "-o", "ExitOnForwardFailure=yes",
    "-o", "StrictHostKeyChecking=yes",
    "-o", `UserKnownHostsFile=${config.knownHostsFile}`,
    "-o", "GlobalKnownHostsFile=/dev/null",
    "-o", "UpdateHostKeys=no",
    "-o", "IdentitiesOnly=yes",
    "-o", "IdentityAgent=none",
    "-o", "PreferredAuthentications=publickey",
    "-o", "PasswordAuthentication=no",
    "-o", "KbdInteractiveAuthentication=no",
    "-o", "GSSAPIAuthentication=no",
    "-o", "HostbasedAuthentication=no",
    "-o", "AddKeysToAgent=no",
    "-o", "ForwardAgent=no",
    "-o", "ForwardX11=no",
    "-o", "ControlMaster=no",
    "-o", "ControlPath=none",
    "-o", "ControlPersist=no",
    "-o", "ClearAllForwardings=yes",
    "-o", "Tunnel=no",
    "-o", "PermitLocalCommand=no",
    "-o", "RequestTTY=no",
    "-o", "ConnectTimeout=10",
    "-i", config.identityFile,
    "-p", String(config.port),
    "-l", config.user,
    "-W", "%h:%p",
    "--",
    config.host,
  ];
  return args.map(shellWord).join(" ");
}

export function sshArgs(config: SshTransportConfig): string[] {
  const remoteHost = config.remoteHost === "::1" ? "[::1]" : config.remoteHost;
  const forward = `127.0.0.1:${config.localPort}:${remoteHost}:${config.remotePort}`;
  const args = [
    "-N",
    "-T",
    "-F", "/dev/null",
    "-o", "BatchMode=yes",
    "-o", "ExitOnForwardFailure=yes",
    "-o", "StrictHostKeyChecking=yes",
    "-o", `UserKnownHostsFile=${config.knownHostsFile}`,
    "-o", "GlobalKnownHostsFile=/dev/null",
    "-o", "UpdateHostKeys=no",
    "-o", "IdentitiesOnly=yes",
    "-o", "IdentityAgent=none",
    "-o", "PreferredAuthentications=publickey",
    "-o", "PasswordAuthentication=no",
    "-o", "KbdInteractiveAuthentication=no",
    "-o", "GSSAPIAuthentication=no",
    "-o", "HostbasedAuthentication=no",
    "-o", "AddKeysToAgent=no",
    "-o", "ForwardAgent=no",
    "-o", "ForwardX11=no",
    "-o", "ControlMaster=no",
    "-o", "ControlPath=none",
    "-o", "ControlPersist=no",
    "-o", "GatewayPorts=no",
    "-o", "Tunnel=no",
    "-o", "PermitLocalCommand=no",
    "-o", "ServerAliveInterval=15",
    "-o", "ServerAliveCountMax=3",
    "-o", "ConnectTimeout=10",
  ];
  if (config.jump) args.push("-o", `ProxyCommand=${jumpProxyCommand(config.jump)}`);
  args.push(
    "-i", config.identityFile,
    "-p", String(config.port),
    "-l", config.user,
    "-L", forward,
    "--",
    config.host,
  );
  return args;
}

export function probeLoopbackForward(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    let settled = false;
    const finish = (ready: boolean): void => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(ready);
    };
    socket.setTimeout(250);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

export function reconnectDelayMs(attempts: number): number {
  return Math.min(30_000, 1_000 * 2 ** Math.min(attempts, 5));
}

class SshTunnel {
  private child: ChildProcess | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private readinessTimer: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;
  private stopped = false;
  private ready = false;
  private message: string | null = null;

  constructor(
    private readonly config: SshTransportConfig,
    private readonly sshBinary = "/usr/bin/ssh",
    private readonly forwardProbe: ForwardProbe = probeLoopbackForward,
  ) {}

  start(): void {
    if (this.child || this.retryTimer || this.stopped) return;
    this.ready = false;
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
      this.cancelReadiness();
      this.child = null;
      this.ready = false;
      if (this.stopped) return;
      this.message = stderr.trim() || `ssh exited (${signal ?? code ?? "unknown"})`;
      const delay = reconnectDelayMs(this.attempts);
      this.attempts += 1;
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        this.start();
      }, delay);
    });
    this.checkReadiness(child);
  }

  private checkReadiness(child: ChildProcess): void {
    this.readinessTimer = setTimeout(async () => {
      this.readinessTimer = null;
      if (this.stopped || this.child !== child || child.exitCode !== null) return;
      const ready = await this.forwardProbe(this.config.localPort);
      if (this.stopped || this.child !== child || child.exitCode !== null) return;
      if (ready) {
        this.ready = true;
        this.attempts = 0;
        this.message = null;
        return;
      }
      this.checkReadiness(child);
    }, 100);
  }

  private cancelReadiness(): void {
    if (this.readinessTimer) clearTimeout(this.readinessTimer);
    this.readinessTimer = null;
  }

  stop(): void {
    this.stopped = true;
    this.cancelReadiness();
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.child?.kill("SIGTERM");
    this.child = null;
    this.ready = false;
  }

  status(): TransportStatus {
    if (this.child?.exitCode === null) {
      return {
        kind: "ssh",
        state: this.ready ? "up" : "starting",
        pid: this.child.pid ?? null,
        message: this.message,
      };
    }
    return { kind: "ssh", state: this.retryTimer ? "down" : "starting", pid: null, message: this.message };
  }
}

export class TransportRegistry {
  private readonly tunnels = new Map<string, SshTunnel>();

  constructor(
    nodes: NodeConfig[],
    sshBinary = "/usr/bin/ssh",
    forwardProbe: ForwardProbe = probeLoopbackForward,
  ) {
    for (const node of nodes) {
      if (node.enabled && node.transport.type === "ssh") {
        this.tunnels.set(node.id, new SshTunnel(node.transport, sshBinary, forwardProbe));
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
