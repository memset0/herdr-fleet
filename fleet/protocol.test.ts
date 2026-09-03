import { chmod, mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { formatStatus } from "./control.ts";
import { parseControlRequest, parseControlResponse, sendControl } from "./protocol.ts";

describe("Fleet supervisor protocol", () => {
  test("parses only the closed request and response shapes", () => {
    expect(parseControlRequest('{"operation":"status","generation":"abc"}')).toEqual({
      operation: "status",
      generation: "abc",
    });
    expect(parseControlRequest('{"operation":"shell","generation":"abc"}')).toBeNull();
    expect(parseControlRequest('{"operation":"status","generation":"abc","command":"rm"}')).toBeNull();
    expect(
      parseControlResponse(
        '{"status":"running","generation":"abc","pid":7,"startedAt":1,"children":[{"name":"collie","pid":8,"running":true,"restarts":0,"nextRestartAt":null}]}',
      ),
    ).toMatchObject({ status: "running", generation: "abc", pid: 7 });
    expect(
      parseControlResponse(
        '{"status":"running","generation":"abc","role":"peer","pid":7,"startedAt":1,"children":[{"name":"collie","pid":8,"running":true,"restarts":0,"nextRestartAt":null}]}',
      ),
    ).toMatchObject({ status: "running", generation: "abc", role: "peer", pid: 7 });
    expect(
      parseControlResponse(
        '{"status":"running","generation":"abc","role":"deputy","pid":7,"startedAt":1,"children":[]}',
      ),
    ).toBeNull();
    expect(parseControlResponse('{"status":"running"}')).toBeNull();
  });

  test("keeps schema 1 status text unchanged and adds only schema 2 role", () => {
    const base = {
      status: "running" as const,
      generation: "abc",
      pid: 7,
      startedAt: 1,
      children: [{ name: "collie", pid: 8, running: true, restarts: 0, nextRestartAt: null }],
    };
    expect(formatStatus(base)).toBe(
      "herdr-fleet: supervisor running generation=abc pid=7 collie=running(pid=8)",
    );
    expect(formatStatus({ ...base, role: "peer" })).toBe(
      "herdr-fleet: supervisor running generation=abc role=peer pid=7 collie=running(pid=8)",
    );
  });

  test("exchanges one bounded line over a private Unix socket", async () => {
    const root = await mkdtemp(join(tmpdir(), "herdr-fleet-protocol-"));
    const socketPath = join(root, "control.sock");
    const server = net.createServer((socket) => {
      socket.once("data", () => {
        socket.end(
          '{"status":"running","generation":"abc","pid":7,"startedAt":1,"children":[]}\n',
        );
      });
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(socketPath, () => resolve());
    });
    await chmod(socketPath, 0o600);
    try {
      await expect(sendControl(socketPath, { operation: "status", generation: "abc" })).resolves.toMatchObject({
        status: "running",
        generation: "abc",
      });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await rm(root, { recursive: true, force: true });
    }
  });
});
