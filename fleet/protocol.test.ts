import { chmod, mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

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
    expect(parseControlResponse('{"status":"running"}')).toBeNull();
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
