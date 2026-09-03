import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { closeSync, openSync, statSync, truncateSync } from "node:fs";

import type { ChildStatus } from "./protocol.ts";

const LOG_LIMIT_BYTES = 2 * 1024 * 1024;

export interface ManagedChildOptions {
  readonly name: string;
  readonly command: readonly string[];
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
  readonly logPath: string;
  readonly minBackoffMs?: number;
  readonly maxBackoffMs?: number;
}

export function childBackoffMs(restarts: number, minimum = 1_000, maximum = 30_000): number {
  return Math.min(maximum, minimum * 2 ** Math.min(restarts, 8));
}

export class ManagedChild {
  private child: ChildProcess | null = null;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private stopping = false;
  private restartCount = 0;
  private nextRestart = 0;
  private lastStartedAt = 0;

  constructor(private readonly options: ManagedChildOptions) {}

  start(): void {
    if (this.child !== null || this.restartTimer !== null || this.stopping) return;
    this.spawnNow();
  }

  private spawnNow(): void {
    if (this.stopping) return;
    const [program, ...args] = this.options.command;
    if (program === undefined) throw new Error(`${this.options.name} command is empty`);
    try {
      if (statSync(this.options.logPath).size >= LOG_LIMIT_BYTES) truncateSync(this.options.logPath, 0);
    } catch {
      // The append open below creates a missing log.
    }
    const descriptor = openSync(this.options.logPath, "a", 0o600);
    try {
      this.child = spawn(program, args, {
        cwd: this.options.cwd,
        env: this.options.env,
        stdio: ["ignore", descriptor, descriptor],
      });
    } finally {
      closeSync(descriptor);
    }
    this.lastStartedAt = Date.now();
    this.nextRestart = 0;
    this.child.once("error", () => undefined);
    this.child.once("close", () => {
      this.child = null;
      if (!this.stopping) this.scheduleRestart();
    });
  }

  private scheduleRestart(): void {
    if (Date.now() - this.lastStartedAt > 60_000) this.restartCount = 0;
    const delay = childBackoffMs(
      this.restartCount,
      this.options.minBackoffMs,
      this.options.maxBackoffMs,
    );
    this.restartCount += 1;
    this.nextRestart = Date.now() + delay;
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      this.spawnNow();
    }, delay);
  }

  async restart(): Promise<void> {
    await this.stopProcess(false);
    this.stopping = false;
    this.restartCount = 0;
    this.start();
  }

  async stop(): Promise<void> {
    await this.stopProcess(true);
  }

  private async stopProcess(final: boolean): Promise<void> {
    this.stopping = true;
    if (this.restartTimer !== null) clearTimeout(this.restartTimer);
    this.restartTimer = null;
    this.nextRestart = 0;
    const child = this.child;
    if (child === null) return;
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGTERM");
      const outcome = await Promise.race([
        once(child, "close").then(() => "closed" as const),
        Bun.sleep(5_000).then(() => "timeout" as const),
      ]);
      if (outcome === "timeout" && child.exitCode === null && child.signalCode === null) {
        child.kill("SIGKILL");
      }
    }
    this.child = null;
    if (!final) this.stopping = false;
  }

  status(): ChildStatus {
    return {
      name: this.options.name,
      pid: this.child?.pid ?? null,
      running: this.child !== null && this.child.exitCode === null,
      restarts: this.restartCount,
      nextRestartAt: this.nextRestart === 0 ? null : this.nextRestart,
    };
  }
}
