import { spawn, type ChildProcess } from "node:child_process";
import { closeSync, openSync, statSync, truncateSync } from "node:fs";

import type { ChildStatus } from "./protocol.ts";

const LOG_LIMIT_BYTES = 2 * 1024 * 1024;

export interface ManagedChildOptions {
  name: string;
  command: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  logPath: string;
  minBackoffMs?: number;
  maxBackoffMs?: number;
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
    if (this.child || this.restartTimer || this.stopping) return;
    this.spawnNow();
  }

  private spawnNow(): void {
    if (this.stopping) return;
    const [program, ...args] = this.options.command;
    if (!program) throw new Error(`${this.options.name} command is empty`);
    try {
      if (statSync(this.options.logPath).size >= LOG_LIMIT_BYTES) truncateSync(this.options.logPath, 0);
    } catch {
      // The append open below creates a missing log.
    }
    const fd = openSync(this.options.logPath, "a", 0o600);
    try {
      this.child = spawn(program, args, {
        cwd: this.options.cwd,
        env: this.options.env,
        stdio: ["ignore", fd, fd],
      });
    } finally {
      closeSync(fd);
    }
    this.lastStartedAt = Date.now();
    this.nextRestart = 0;
    this.child.once("error", () => {
      // The exit handler (or close after a failed spawn) owns retry scheduling.
    });
    this.child.once("close", () => {
      this.child = null;
      if (!this.stopping) this.scheduleRestart();
    });
  }

  private scheduleRestart(): void {
    const min = this.options.minBackoffMs ?? 1_000;
    const max = this.options.maxBackoffMs ?? 30_000;
    if (Date.now() - this.lastStartedAt > 60_000) this.restartCount = 0;
    const delay = Math.min(max, min * 2 ** Math.min(this.restartCount, 8));
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
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
      this.nextRestart = 0;
    }
    const child = this.child;
    if (!child) return;
    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(forceTimer);
        resolve();
      };
      child.once("close", finish);
      if (child.exitCode !== null || child.signalCode !== null) {
        finish();
        return;
      }
      child.kill("SIGTERM");
      const forceTimer = setTimeout(() => {
        child.kill("SIGKILL");
        finish();
      }, 5_000);
    });
    this.child = null;
    if (!final) this.stopping = false;
  }

  status(): ChildStatus {
    return {
      name: this.options.name,
      pid: this.child?.pid ?? null,
      running: Boolean(this.child && this.child.exitCode === null),
      restarts: this.restartCount,
      nextRestartAt: this.nextRestart || null,
    };
  }
}
