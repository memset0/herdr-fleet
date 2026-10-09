import { afterAll, describe, expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough, Writable } from "node:stream";

import {
  ManualPaneFitControllerError,
  ManualPaneFitControllerManager,
  validPaneFitColumns,
  validPaneFitRows,
  type PaneFitControllerChild,
  type PaneFitControllerSpawner,
} from "./controller.ts";

class FakeChild extends EventEmitter implements PaneFitControllerChild {
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
  readonly writes: string[] = [];
  readonly killed: NodeJS.Signals[] = [];
  readonly stdin: Writable;
  readonly delayed: DelayedWritable | null;

  constructor(delayedWrites = false) {
    super();
    this.delayed = delayedWrites ? new DelayedWritable(this.writes) : null;
    this.stdin =
      this.delayed ??
      new Writable({
          write: (chunk, _encoding, callback) => {
            this.writes.push(String(chunk));
            callback();
          },
        });
  }

  kill(signal: NodeJS.Signals = "SIGTERM"): boolean {
    this.killed.push(signal);
    return true;
  }
}

class DelayedWritable extends Writable {
  readonly callbacks: Array<() => void> = [];

  constructor(private readonly writes: string[]) {
    super();
  }

  override _write(
    chunk: Buffer,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    this.writes.push(String(chunk));
    this.callbacks.push(() => callback());
  }

  flushOne(): void {
    this.callbacks.shift()?.();
  }
}

function harness(options: { readonly delayedWrites?: boolean; readonly readyTimeoutMs?: number } = {}) {
  const children: FakeChild[] = [];
  const calls: Array<{ binary: string; args: string[]; env: NodeJS.ProcessEnv }> = [];
  const spawn: PaneFitControllerSpawner = (binary, args, spawnOptions) => {
    const child = new FakeChild(options.delayedWrites);
    children.push(child);
    calls.push({ binary, args, env: spawnOptions.env });
    return child;
  };
  const manager = new ManualPaneFitControllerManager({
    binary: "/opt/herdr/bin/herdr",
    env: { PATH: "/usr/bin", HERDR_SOCKET_PATH: "/wrong.sock" },
    spawn,
    readyTimeoutMs: options.readyTimeoutMs,
  });
  return { manager, children, calls };
}

describe("manual Pane fit dimensions", () => {
  test("accepts only bounded whole columns and protocol-safe rows", () => {
    expect(validPaneFitColumns(20)).toBeTrue();
    expect(validPaneFitColumns(500)).toBeTrue();
    expect(validPaneFitRows(1)).toBeTrue();
    expect(validPaneFitRows(65_535)).toBeTrue();
    for (const value of [19, 501, 80.5]) {
      expect(validPaneFitColumns(value)).toBeFalse();
    }
    for (const value of [0, 65_536, 24.5]) {
      expect(validPaneFitRows(value)).toBeFalse();
    }
  });
});

describe("ManualPaneFitControllerManager", () => {
  test("acquires on the trusted socket without takeover and reuses the owned controller", async () => {
    const { manager, children, calls } = harness();
    const first = manager.resize("/sessions/demo/herdr.sock", "w1:p1", { cols: 72, rows: 31 });
    expect(calls).toEqual([
      {
        binary: "/opt/herdr/bin/herdr",
        args: [
          "terminal",
          "session",
          "control",
          "w1:p1",
          "--cols",
          "72",
          "--rows",
          "31",
        ],
        env: { PATH: "/usr/bin", HERDR_SOCKET_PATH: "/sessions/demo/herdr.sock" },
      },
    ]);
    expect(calls[0]!.args).not.toContain("--takeover");
    children[0]!.stdout.write('{"type":"terminal.frame","bytes":""}\n');
    await first;

    await manager.resize("/sessions/demo/herdr.sock", "w1:p1", { cols: 54, rows: 31 });
    expect(calls).toHaveLength(1);
    expect(children[0]!.writes).toContain(
      `${JSON.stringify({ type: "terminal.resize", cols: 54, rows: 31 })}\n`,
    );
  });

  test("serializes repeated resize commands on one retained lease", async () => {
    const { manager, children } = harness({ delayedWrites: true });
    const acquired = manager.resize("/sessions/demo/herdr.sock", "w1:p1", { cols: 72, rows: 31 });
    children[0]!.stdout.write('{"type":"terminal.frame","bytes":""}\n');
    await acquired;

    const first = manager.resize("/sessions/demo/herdr.sock", "w1:p1", { cols: 60, rows: 31 });
    const second = manager.resize("/sessions/demo/herdr.sock", "w1:p1", { cols: 50, rows: 31 });
    await Bun.sleep(0);
    expect(children[0]!.writes).toHaveLength(1);
    const stdin = children[0]!.delayed;
    if (stdin === null) throw new Error("delayed writer missing");
    stdin.flushOne();
    await first;
    await Promise.resolve();
    expect(children[0]!.writes).toHaveLength(2);
    stdin.flushOne();
    await second;
  });

  test("surfaces conflict without retaining or taking over the refused controller", async () => {
    const { manager, children } = harness();
    const resize = manager.resize("/sessions/demo/herdr.sock", "w1:p1", { cols: 60, rows: 24 });
    children[0]!.stdout.write(
      `${JSON.stringify({ type: "terminal.closed", reason: "terminal already has a controller" })}\n`,
    );
    await expect(resize).rejects.toMatchObject({
      failure: "conflict",
    } satisfies Partial<ManualPaneFitControllerError>);
    expect(children[0]!.killed).toEqual(["SIGTERM"]);
    expect(manager.activeCount).toBe(0);
  });

  test("cleans up early exit, startup failure, and timeout", async () => {
    const exited = harness();
    const exitResize = exited.manager.resize("/sessions/demo/herdr.sock", "w1:p1", {
      cols: 60,
      rows: 24,
    });
    exited.children[0]!.emit("exit", 1, null);
    await expect(exitResize).rejects.toMatchObject({ failure: "failed" });
    expect(exited.manager.activeCount).toBe(0);

    const timed = harness({ readyTimeoutMs: 5 });
    await expect(
      timed.manager.resize("/sessions/demo/herdr.sock", "w1:p1", { cols: 60, rows: 24 }),
    ).rejects.toMatchObject({ failure: "failed" });
    expect(timed.manager.activeCount).toBe(0);
  });

  test("recognises Herdr 0.9's attached-client refusal as a conflict", async () => {
    const { manager, children } = harness();
    const resize = manager.resize("/run/herdr.sock", "w1:p1", { cols: 60, rows: 24 });
    children[0]!.stdout.write(
      `${JSON.stringify({
        type: "terminal.closed",
        reason: "terminal attach failed: terminal term_x already has an attached client; retry with --takeover",
      })}\n`,
    );
    await expect(resize).rejects.toMatchObject({ failure: "conflict" });
    expect(manager.activeCount).toBe(0);
  });

  test("forgets a controller that exits after acquisition and acquires afresh", async () => {
    // A held browser attachment (attach --takeover) displaces the controller, and closing the Pane
    // ends it: both are an exit, and neither may leave a lease that points at a dead child.
    const { manager, children, calls } = harness();
    const first = manager.resize("/run/herdr.sock", "w1:p1", { cols: 60, rows: 24 });
    children[0]!.stdout.write('{"type":"terminal.frame","bytes":""}\n');
    await first;
    expect(manager.activeCount).toBe(1);
    children[0]!.emit("exit", 0, null);
    expect(manager.activeCount).toBe(0);
    const again = manager.resize("/run/herdr.sock", "w1:p1", { cols: 70, rows: 24 });
    expect(calls).toHaveLength(2);
    children[1]!.stdout.write('{"type":"terminal.frame","bytes":""}\n');
    await again;
  });

  test("releases every owned lease on dispose", async () => {
    const { manager, children } = harness();
    const requests = [
      manager.resize("/sessions/a/herdr.sock", "w1:p1", { cols: 60, rows: 24 }),
      manager.resize("/sessions/b/herdr.sock", "w1:p1", { cols: 60, rows: 24 }),
    ];
    for (const child of children) child.stdout.write('{"type":"terminal.frame","bytes":""}\n');
    await Promise.all(requests);
    manager.disposeAll();
    expect(children[0]!.writes).toContain(`${JSON.stringify({ type: "terminal.release" })}\n`);
    expect(children.map((child) => child.killed)).toEqual([["SIGTERM"], ["SIGTERM"]]);
    expect(manager.activeCount).toBe(0);
  });
});

describe("the controller's default binary", () => {
  const made: string[] = [];
  afterAll(async () => {
    for (const dir of made) await rm(dir, { recursive: true, force: true });
  });

  async function spawnedBinary(env: NodeJS.ProcessEnv): Promise<string> {
    const seen: string[] = [];
    const manager = new ManualPaneFitControllerManager({
      env,
      spawn: (binary) => {
        seen.push(binary);
        return new FakeChild();
      },
      readyTimeoutMs: 1,
    });
    const pending = manager.resize("/sessions/demo/herdr.sock", "w1:p1", { cols: 72, rows: 31 });
    manager.disposeAll();
    await expect(pending).rejects.toBeInstanceOf(ManualPaneFitControllerError);
    return seen[0] ?? "";
  }

  test("is the shared resolution: the stated binary outside PATH, else the bare name", async () => {
    const dir = await mkdtemp(join(tmpdir(), "herdr-fleet-fit-binary-"));
    made.push(dir);
    const binary = join(dir, "herdr");
    await writeFile(binary, "#!/bin/sh\n");
    await chmod(binary, 0o755);
    expect(await spawnedBinary({ HERDR_BIN_PATH: binary, PATH: join(dir, "empty") })).toBe(binary);
    expect(await spawnedBinary({ PATH: join(dir, "empty") })).toBe("herdr");
  });
});
