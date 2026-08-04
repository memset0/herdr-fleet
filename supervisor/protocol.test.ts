import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { sendControl } from "./protocol.ts";

const temporary: string[] = [];
const servers: net.Server[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  await Promise.all(temporary.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function listen(handler: (socket: net.Socket) => void): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "web-remote-protocol-test-"));
  temporary.push(root);
  const path = join(root, "control.sock");
  const server = net.createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(path, resolve);
  });
  return path;
}

describe("private control protocol", () => {
  test("exchanges one newline-delimited request and response", async () => {
    const path = await listen((socket) => {
      socket.once("data", () =>
        socket.end(`${JSON.stringify({ status: "running", generation: "g1", pid: 10, startedAt: 1, children: [] })}\n`),
      );
    });
    expect(await sendControl(path, { operation: "status", generation: "g1" })).toMatchObject({
      status: "running",
      generation: "g1",
      pid: 10,
    });
  });

  test("bounds unresponsive and malformed peers", async () => {
    const timeoutPath = await listen(() => undefined);
    await expect(sendControl(timeoutPath, { operation: "status", generation: "g1" }, 25)).rejects.toThrow("timed out");
    const invalidPath = await listen((socket) => socket.end("not-json\n"));
    await expect(sendControl(invalidPath, { operation: "status", generation: "g1" })).rejects.toThrow("invalid supervisor response");
  });
});
