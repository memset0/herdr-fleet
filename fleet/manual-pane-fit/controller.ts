import { spawn as nodeSpawn } from "node:child_process";
import type { Readable, Writable } from "node:stream";
import type { JsonValue } from "../../bridge/json.ts";
import { jsonRecord, jsonStringField } from "../../bridge/stt/json.ts";

export const MIN_PANE_FIT_COLS = 20;
export const MAX_PANE_FIT_COLS = 500;
export const MIN_PANE_FIT_ROWS = 1;
export const MAX_PANE_FIT_ROWS = 65_535;

const DEFAULT_READY_TIMEOUT_MS = 5_000;
const MAX_FRAME_BYTES = 2 * 1024 * 1024;

export type ManualPaneFitControllerFailure = "conflict" | "failed";

export class ManualPaneFitControllerError extends Error {
  constructor(readonly failure: ManualPaneFitControllerFailure) {
    super(failure === "conflict" ? "Pane already has another controller" : "Pane resize failed");
    this.name = "ManualPaneFitControllerError";
  }
}

export interface PaneFitSize {
  readonly cols: number;
  readonly rows: number;
}

export interface PaneFitControllerChild {
  readonly stdin: Writable;
  readonly stdout: Readable;
  readonly stderr: Readable;
  once(event: "error", listener: (error: Error) => void): this;
  once(
    event: "exit",
    listener: (code: number | null, signal: NodeJS.Signals | null) => void,
  ): this;
  kill(signal?: NodeJS.Signals): boolean;
}

export type PaneFitControllerSpawner = (
  binary: string,
  args: string[],
  options: { env: NodeJS.ProcessEnv; stdio: ["pipe", "pipe", "pipe"] },
) => PaneFitControllerChild;

interface ControllerLease {
  readonly socketPath: string;
  readonly paneId: string;
  readonly child: PaneFitControllerChild;
  readonly ready: Promise<void>;
  tail: Promise<void>;
}

export function validPaneFitColumns(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= MIN_PANE_FIT_COLS &&
    value <= MAX_PANE_FIT_COLS
  );
}

export function validPaneFitRows(value: number | undefined): value is number {
  return (
    value !== undefined &&
    Number.isInteger(value) &&
    value >= MIN_PANE_FIT_ROWS &&
    value <= MAX_PANE_FIT_ROWS
  );
}

export class ManualPaneFitControllerManager {
  private readonly leases = new Map<string, ControllerLease>();
  private readonly binary: string;
  private readonly spawn: PaneFitControllerSpawner;
  private readonly readyTimeoutMs: number;
  private readonly environment: NodeJS.ProcessEnv;

  constructor(options: {
    readonly binary?: string;
    readonly spawn?: PaneFitControllerSpawner;
    readonly readyTimeoutMs?: number;
    readonly env?: NodeJS.ProcessEnv;
  } = {}) {
    this.environment = options.env ?? process.env;
    this.binary = options.binary ?? (this.environment.HERDR_BIN_PATH?.trim() || "herdr");
    this.spawn =
      options.spawn ??
      ((binary, args, spawnOptions) => nodeSpawn(binary, args, spawnOptions));
    this.readyTimeoutMs = options.readyTimeoutMs ?? DEFAULT_READY_TIMEOUT_MS;
  }

  get activeCount(): number {
    return this.leases.size;
  }

  async resize(socketPath: string, paneId: string, size: PaneFitSize): Promise<void> {
    if (!validPaneFitColumns(size.cols) || !validPaneFitRows(size.rows)) {
      throw new ManualPaneFitControllerError("failed");
    }

    const key = leaseKey(socketPath, paneId);
    const existing = this.leases.get(key);
    if (existing !== undefined) {
      await existing.ready;
      if (this.leases.get(key) !== existing) return this.resize(socketPath, paneId, size);
      return this.enqueueResize(key, existing, size);
    }

    let child: PaneFitControllerChild;
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
          env: { ...this.environment, HERDR_SOCKET_PATH: socketPath },
          stdio: ["pipe", "pipe", "pipe"],
        },
      );
    } catch {
      throw new ManualPaneFitControllerError("failed");
    }

    const lease: ControllerLease = {
      socketPath,
      paneId,
      child,
      ready: this.waitUntilReady(child),
      tail: Promise.resolve(),
    };
    this.leases.set(key, lease);
    child.stderr.resume();
    child.once("exit", () => {
      if (this.leases.get(key) === lease) this.leases.delete(key);
    });

    try {
      await lease.ready;
    } catch (cause) {
      this.releaseLease(key, lease);
      throw cause;
    }
  }

  releasePane(socketPath: string, paneId: string): void {
    const key = leaseKey(socketPath, paneId);
    const lease = this.leases.get(key);
    if (lease !== undefined) this.releaseLease(key, lease);
  }

  releaseSession(socketPath: string): void {
    for (const [key, lease] of this.leases) {
      if (lease.socketPath === socketPath) this.releaseLease(key, lease);
    }
  }

  disposeAll(): void {
    for (const [key, lease] of this.leases) this.releaseLease(key, lease);
  }

  private enqueueResize(
    key: string,
    lease: ControllerLease,
    size: PaneFitSize,
  ): Promise<void> {
    const operation = lease.tail.then(() =>
      writeCommand(lease.child.stdin, { type: "terminal.resize", ...size }),
    );
    lease.tail = operation.catch(() => {});
    return operation.catch(() => {
      this.releaseLease(key, lease);
      throw new ManualPaneFitControllerError("failed");
    });
  }

  private releaseLease(key: string, lease: ControllerLease): void {
    if (this.leases.get(key) !== lease) return;
    this.leases.delete(key);
    try {
      lease.child.stdin.write(`${JSON.stringify({ type: "terminal.release" })}\n`, () => {});
    } catch {
      // The owned controller is already gone.
    }
    try {
      lease.child.kill("SIGTERM");
    } catch {
      // The owned controller is already gone.
    }
  }

  private waitUntilReady(child: PaneFitControllerChild): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      let stdout = "";
      const finish = (failure?: ManualPaneFitControllerFailure) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (failure === undefined) {
          resolve();
          return;
        }
        reject(new ManualPaneFitControllerError(failure));
      };
      const timer = setTimeout(() => finish("failed"), this.readyTimeoutMs);
      timer.unref();

      child.stdout.on("data", (chunk: Buffer | string) => {
        if (settled) return;
        stdout += String(chunk);
        if (stdout.length > MAX_FRAME_BYTES) {
          finish("failed");
          return;
        }
        let newline = stdout.indexOf("\n");
        while (newline >= 0) {
          const line = stdout.slice(0, newline);
          stdout = stdout.slice(newline + 1);
          if (line.trim() !== "") {
            const record = parseControllerRecord(line);
            if (record === null) {
              finish("failed");
              return;
            }
            if (record.type === "terminal.frame") {
              finish();
              return;
            }
            if (record.type === "terminal.closed") {
              finish(isControllerConflict(record.reason) ? "conflict" : "failed");
              return;
            }
          }
          newline = stdout.indexOf("\n");
        }
      });
      child.once("error", () => finish("failed"));
      child.once("exit", () => finish("failed"));
    });
  }
}

function leaseKey(socketPath: string, paneId: string): string {
  return `${socketPath}\u0000${paneId}`;
}

type ControllerRecord =
  | { readonly type: "terminal.frame" }
  | { readonly type: "terminal.closed"; readonly reason: string };

function parseControllerRecord(line: string): ControllerRecord | null {
  let value: JsonValue;
  try {
    // SAFETY: JSON.parse returns the JsonValue representation; the record and fields are parsed below.
    value = JSON.parse(line) as JsonValue;
  } catch {
    return null;
  }
  const record = jsonRecord(value);
  if (record === null) return null;
  const type = jsonStringField(record.type);
  if (type === "terminal.frame") return { type };
  if (type !== "terminal.closed") return null;
  const reason = jsonStringField(record.reason);
  return reason === null ? null : { type, reason };
}

function isControllerConflict(reason: string): boolean {
  const normalized = reason.toLowerCase();
  return normalized.includes("controller") && (
    normalized.includes("already") ||
    normalized.includes("owned") ||
    normalized.includes("control")
  );
}

type ControllerCommand =
  | { readonly type: "terminal.resize"; readonly cols: number; readonly rows: number }
  | { readonly type: "terminal.release" };

function writeCommand(stdin: Writable, command: ControllerCommand): Promise<void> {
  return new Promise((resolve, reject) => {
    stdin.write(`${JSON.stringify(command)}\n`, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}
