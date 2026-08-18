import { spawn as nodeSpawn } from "node:child_process";
import type { Readable, Writable } from "node:stream";

export const MIN_TERMINAL_COLS = 20;
export const MAX_TERMINAL_COLS = 500;
export const MIN_TERMINAL_ROWS = 1;
// Herdr's terminal protocol carries u16 geometry. Rows are not browser-controlled here — retaining
// the whole range means an unusually tall desktop Pane can still be preserved exactly.
export const MAX_TERMINAL_ROWS = 65_535;

const DEFAULT_READY_TIMEOUT_MS = 5_000;
const MAX_FRAME_LINE_BYTES = 2 * 1024 * 1024;
const MAX_STDERR_CHARS = 4_096;

export interface TerminalSize {
  cols: number;
  rows: number;
}

export interface TerminalControllerChild {
  stdin: Writable;
  stdout: Readable;
  stderr: Readable;
  once(event: "error", listener: (error: Error) => void): this;
  once(
    event: "exit",
    listener: (code: number | null, signal: NodeJS.Signals | null) => void,
  ): this;
  kill(signal?: NodeJS.Signals): boolean;
}

export type TerminalControllerSpawner = (
  binary: string,
  args: string[],
  opts: { env: NodeJS.ProcessEnv; stdio: ["pipe", "pipe", "pipe"] },
) => TerminalControllerChild;

interface Controller {
  child: TerminalControllerChild;
  ready: Promise<void>;
}

/** Strict integer/range validation for the public resize body. Never silently rounds client data. */
export function validTerminalColumns(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_TERMINAL_COLS &&
    value <= MAX_TERMINAL_COLS
  );
}

function validTerminalRows(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_TERMINAL_ROWS &&
    value <= MAX_TERMINAL_ROWS
  );
}

/**
 * Owns the long-lived Herdr terminal-session controllers used by the manual Display → Resize action.
 * One process per socket+Pane is intentional: Herdr restores the desktop layout's PTY size as soon
 * as a controller disconnects, so a fire-and-forget child would make a successful HTTP response a
 * lie. The process only holds resize ownership; its rendered frames are drained and discarded.
 */
export class TerminalResizeManager {
  private readonly controllers = new Map<string, Controller>();
  private readonly binary: string;
  private readonly spawn: TerminalControllerSpawner;
  private readonly readyTimeoutMs: number;
  private readonly baseEnv: NodeJS.ProcessEnv;

  constructor(opts: {
    binary?: string;
    spawn?: TerminalControllerSpawner;
    readyTimeoutMs?: number;
    env?: NodeJS.ProcessEnv;
  } = {}) {
    this.baseEnv = opts.env ?? process.env;
    this.binary = opts.binary ?? (this.baseEnv.HERDR_BIN_PATH?.trim() || "herdr");
    this.spawn =
      opts.spawn ??
      ((binary, args, spawnOpts) =>
        nodeSpawn(binary, args, spawnOpts) as unknown as TerminalControllerChild);
    this.readyTimeoutMs = opts.readyTimeoutMs ?? DEFAULT_READY_TIMEOUT_MS;
  }

  get activeCount(): number {
    return this.controllers.size;
  }

  async resize(socketPath: string, paneId: string, size: TerminalSize): Promise<void> {
    if (!validTerminalColumns(size.cols) || !validTerminalRows(size.rows)) {
      throw new Error("terminal size out of range");
    }

    const key = `${socketPath}\u0000${paneId}`;
    const existing = this.controllers.get(key);
    if (existing) {
      await existing.ready;
      // The controller may have exited while readiness settled. Retry acquisition once through the
      // normal path rather than writing into a dead stdin.
      if (this.controllers.get(key) !== existing) return this.resize(socketPath, paneId, size);
      await writeCommand(existing.child.stdin, { type: "terminal.resize", ...size });
      return;
    }

    let child: TerminalControllerChild;
    try {
      child = this.spawn(
        this.binary,
        [
          "terminal",
          "session",
          "control",
          paneId,
          "--cols",
          String(size.cols),
          "--rows",
          String(size.rows),
        ],
        {
          env: { ...this.baseEnv, HERDR_SOCKET_PATH: socketPath },
          stdio: ["pipe", "pipe", "pipe"],
        },
      );
    } catch (error) {
      throw new Error(`could not start Herdr terminal controller: ${errorMessage(error)}`);
    }

    const controller: Controller = {
      child,
      ready: this.waitUntilReady(child),
    };
    this.controllers.set(key, controller);
    child.once("exit", () => {
      if (this.controllers.get(key) === controller) this.controllers.delete(key);
    });

    try {
      await controller.ready;
    } catch (error) {
      if (this.controllers.get(key) === controller) this.controllers.delete(key);
      child.kill("SIGTERM");
      throw error;
    }
  }

  /** Bridge shutdown: release ownership and ensure no child can keep the process alive. */
  disposeAll(): void {
    for (const { child } of this.controllers.values()) {
      // Best effort: a dead pipe is already released. SIGTERM immediately after this still closes
      // the socket, which triggers the same Herdr restore path even if stdin has not flushed.
      try {
        child.stdin.write(`${JSON.stringify({ type: "terminal.release" })}\n`, () => {});
      } catch {
        // The process has already released ownership.
      }
      try {
        child.kill("SIGTERM");
      } catch {
        // Already gone.
      }
    }
    this.controllers.clear();
  }

  private waitUntilReady(child: TerminalControllerChild): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      let stdout = "";
      let stderr = "";

      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        error ? reject(error) : resolve();
      };

      const detail = (fallback: string) => {
        const suffix = stderr.trim();
        return suffix ? `${fallback}: ${suffix}` : fallback;
      };

      const timer = setTimeout(
        () => finish(new Error(detail("Herdr terminal controller timed out"))),
        this.readyTimeoutMs,
      );
      timer.unref();

      child.stderr.on("data", (chunk: Buffer | string) => {
        if (stderr.length >= MAX_STDERR_CHARS) return;
        stderr = (stderr + String(chunk)).slice(0, MAX_STDERR_CHARS);
      });
      child.stdout.on("data", (chunk: Buffer | string) => {
        if (settled) return; // listener stays attached so the stream is still drained
        stdout += String(chunk);
        if (stdout.length > MAX_FRAME_LINE_BYTES) {
          finish(new Error("Herdr terminal controller sent an oversized frame"));
          return;
        }
        let nl = stdout.indexOf("\n");
        while (nl >= 0 && !settled) {
          const line = stdout.slice(0, nl);
          stdout = stdout.slice(nl + 1);
          if (line.trim()) {
            let record: unknown;
            try {
              record = JSON.parse(line);
            } catch {
              finish(new Error(detail("Herdr terminal controller sent malformed output")));
              return;
            }
            const type = (record as { type?: unknown }).type;
            if (type === "terminal.frame") {
              finish();
              return;
            }
            if (type === "terminal.closed") {
              const reason = (record as { reason?: unknown }).reason;
              finish(
                new Error(
                  typeof reason === "string" && reason
                    ? reason
                    : detail("Herdr terminal controller closed before resize"),
                ),
              );
              return;
            }
          }
          nl = stdout.indexOf("\n");
        }
      });
      child.once("error", (error) =>
        finish(new Error(detail(`could not start Herdr terminal controller: ${error.message}`))),
      );
      child.once("exit", (code, signal) => {
        const why = signal ? `signal ${signal}` : `exit ${code ?? "unknown"}`;
        finish(new Error(detail(`Herdr terminal controller ended before resize (${why})`)));
      });
    });
  }
}

function writeCommand(stdin: Writable, command: object): Promise<void> {
  return new Promise((resolve, reject) => {
    stdin.write(`${JSON.stringify(command)}\n`, (error) => {
      if (error) reject(new Error(`Herdr terminal resize failed: ${error.message}`));
      else resolve();
    });
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
