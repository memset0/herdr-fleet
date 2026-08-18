import { describe, expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";

import {
  TerminalResizeManager,
  validTerminalColumns,
  type TerminalControllerChild,
  type TerminalControllerSpawner,
} from "./terminal-resize.ts";

class FakeChild extends EventEmitter implements TerminalControllerChild {
  readonly stdin = new PassThrough();
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
  readonly writes: string[] = [];
  readonly killed: NodeJS.Signals[] = [];

  constructor() {
    super();
    this.stdin.on("data", (chunk) => this.writes.push(String(chunk)));
  }

  kill(signal: NodeJS.Signals = "SIGTERM"): boolean {
    this.killed.push(signal);
    return true;
  }
}

function harness(opts: { readyTimeoutMs?: number } = {}) {
  const children: FakeChild[] = [];
  const calls: Array<{ binary: string; args: string[]; env: NodeJS.ProcessEnv }> = [];
  const spawn: TerminalControllerSpawner = (binary, args, spawnOpts) => {
    const child = new FakeChild();
    children.push(child);
    calls.push({ binary, args, env: spawnOpts.env });
    return child;
  };
  const manager = new TerminalResizeManager({
    binary: "/opt/herdr/bin/herdr",
    env: { PATH: "/usr/bin", HERDR_SOCKET_PATH: "/wrong.sock" },
    spawn,
    readyTimeoutMs: opts.readyTimeoutMs,
  });
  return { manager, children, calls };
}

describe("validTerminalColumns", () => {
  test("accepts only bounded whole columns", () => {
    expect(validTerminalColumns(20)).toBe(true);
    expect(validTerminalColumns(500)).toBe(true);
    for (const value of [19, 501, 80.5, "80", null, undefined]) {
      expect(validTerminalColumns(value)).toBe(false);
    }
  });
});

describe("TerminalResizeManager", () => {
  test("acquires without takeover on the exact session socket, then reuses the controller", async () => {
    const { manager, children, calls } = harness();
    const first = manager.resize("/sessions/demo/herdr.sock", "w1:p1", { cols: 72, rows: 31 });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({
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
    });
    expect(calls[0]!.args).not.toContain("--takeover");

    children[0]!.stdout.write('{"type":"terminal.frame","bytes":""}\n');
    await first;
    expect(manager.activeCount).toBe(1);

    await manager.resize("/sessions/demo/herdr.sock", "w1:p1", { cols: 54, rows: 31 });
    expect(calls).toHaveLength(1);
    expect(children[0]!.writes).toContain(
      `${JSON.stringify({ type: "terminal.resize", cols: 54, rows: 31 })}\n`,
    );
  });

  test("surfaces a controller conflict and does not retain the refused child", async () => {
    const { manager, children } = harness();
    const resize = manager.resize("/tmp/herdr.sock", "w1:p1", { cols: 60, rows: 24 });
    children[0]!.stdout.write(
      `${JSON.stringify({ type: "terminal.closed", reason: "terminal already has a controller" })}\n`,
    );
    await expect(resize).rejects.toThrow("already has a controller");
    expect(children[0]!.killed).toEqual(["SIGTERM"]);
    expect(manager.activeCount).toBe(0);
  });

  test("times out a silent controller and includes bounded stderr context", async () => {
    const { manager, children } = harness({ readyTimeoutMs: 10 });
    const resize = manager.resize("/tmp/herdr.sock", "w1:p1", { cols: 60, rows: 24 });
    children[0]!.stderr.write("diagnostic");
    await expect(resize).rejects.toThrow("timed out: diagnostic");
    expect(manager.activeCount).toBe(0);
  });

  test("releases and terminates every retained child on bridge shutdown", async () => {
    const { manager, children } = harness();
    const resize = manager.resize("/tmp/herdr.sock", "w1:p1", { cols: 60, rows: 24 });
    children[0]!.stdout.write('{"type":"terminal.frame","bytes":""}\n');
    await resize;

    manager.disposeAll();
    expect(children[0]!.writes).toContain(`${JSON.stringify({ type: "terminal.release" })}\n`);
    expect(children[0]!.killed).toEqual(["SIGTERM"]);
    expect(manager.activeCount).toBe(0);
  });
});
