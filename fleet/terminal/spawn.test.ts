import { describe, expect, test } from "bun:test";

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Placement } from "./placement.ts";
import {
  ATTACH_COMMAND_NAME,
  SERVER_WS_PATH,
  SERVER_WS_PROTOCOL,
  TERMINAL_SERVER_NAME,
  findTerminalTools,
  awaitSocketBound,
  makeStartServer,
  serverUrl,
  socketIsBound,
  terminalServerArguments,
  type SpawnedChild,
  type TerminalTools,
} from "./spawn.ts";

const TOOLS: TerminalTools = { server: "/synthetic/bin/ttyd", attach: "/synthetic/bin/herdr" };
const GEOMETRY = { columns: 100, rows: 30 };
const at = (terminalId: string): Placement => ({ kind: "local", terminalId, paneId: "w1:p1" });

describe("the two executables", () => {
  test("are found together or not at all", () => {
    const found = findTerminalTools((name) =>
      name === TERMINAL_SERVER_NAME ? TOOLS.server : name === ATTACH_COMMAND_NAME ? TOOLS.attach : null,
    );
    expect(found).toEqual(TOOLS);
  });

  test("half an answer is no answer — a deployment simply offers no terminals", () => {
    expect(findTerminalTools((name) => (name === TERMINAL_SERVER_NAME ? TOOLS.server : null))).toBeNull();
    expect(findTerminalTools((name) => (name === ATTACH_COMMAND_NAME ? TOOLS.attach : null))).toBeNull();
    expect(findTerminalTools(() => null)).toBeNull();
  });
});

describe("what the terminal server is run with", () => {
  const argv = terminalServerArguments(TOOLS, "/run/socket/t1.sock", "term_abc");

  test("binds a socket and never a port", () => {
    expect(argv).toContain("-i");
    expect(argv[argv.indexOf("-i") + 1]).toBe("/run/socket/t1.sock");
    expect(argv).not.toContain("-p");
    expect(argv).not.toContain("--port");
  });

  test("accepts exactly one client and exits when it leaves", () => {
    expect(argv).toContain("-o");
    expect(argv[argv.indexOf("-m") + 1]).toBe("1");
  });

  test("is writable, because a terminal nobody can type into is the mirror", () => {
    expect(argv).toContain("-W");
  });

  test("runs the multiplexer's own attach on exactly the resolved terminal, last", () => {
    expect(argv.slice(-4)).toEqual([TOOLS.attach, "terminal", "attach", "term_abc"]);
  });

  test("carries no credential, no origin check to stand in for one, and no browser", () => {
    for (const flag of ["-c", "--credential", "-B", "--browser", "-a", "--url-arg", "-b", "--base-path"]) {
      expect(argv).not.toContain(flag);
    }
  });

  test("the Gateway dials that socket over the server's own path and subprotocol", () => {
    expect(serverUrl("/run/socket/t1.sock")).toBe(`ws+unix:///run/socket/t1.sock:${SERVER_WS_PATH}`);
    expect(SERVER_WS_PROTOCOL).toBe("tty");
  });
});

function spawnHarness() {
  const commands: (readonly string[])[] = [];
  const killed: number[] = [];
  let index = 0;
  const spawn = (command: readonly string[]): SpawnedChild => {
    commands.push(command);
    const mine = index++;
    return {
      kill: () => killed.push(mine),
      exited: Promise.resolve(0),
    };
  };
  return { commands, killed, spawn };
}

describe("starting one", () => {
  test("names its socket by a counter, so no terminal id ever becomes a path", async () => {
    const h = spawnHarness();
    const start = makeStartServer({
      tools: TOOLS,
      socketDir: "/run/socket",
      spawn: h.spawn,
      awaitSocket: async () => undefined,
    });
    const first = await start(at("term_../../etc/passwd"), GEOMETRY);
    const second = await start(at("term_bbb"), GEOMETRY);
    expect(first.endpoint).toBe(serverUrl("/run/socket/t1.sock"));
    expect(second.endpoint).toBe(serverUrl("/run/socket/t2.sock"));
    // The URL is what the Gateway dials, and it names the socket rather than the terminal.
    expect(first.endpoint).not.toContain("passwd");
    // The id reaches the command it attaches to and nothing else.
    expect(h.commands[0]?.at(-1)).toBe("term_../../etc/passwd");
  });

  test("stopping kills the child, once, however many times it is asked", async () => {
    const h = spawnHarness();
    const start = makeStartServer({
      tools: TOOLS,
      socketDir: "/run/socket",
      spawn: h.spawn,
      awaitSocket: async () => undefined,
    });
    const server = await start(at("term_abc"), GEOMETRY);
    server.stop();
    server.stop();
    expect(h.killed).toEqual([0]);
  });

  test("a socket that never appears kills the child rather than leaving it attached", async () => {
    const h = spawnHarness();
    const start = makeStartServer({
      tools: TOOLS,
      socketDir: "/run/socket",
      spawn: h.spawn,
      awaitSocket: async () => {
        throw new Error("the terminal server did not open its socket");
      },
    });
    await expect(start(at("term_abc"), GEOMETRY)).rejects.toThrow("did not open its socket");
    expect(h.killed).toEqual([0]);
  });
});

describe("knowing the socket is there", () => {
  test("a bound UNIX socket is recognised, and a regular file at the same path is not", async () => {
    const directory = await mkdtemp(join(tmpdir(), "herdr-fleet-socket-test-"));
    const socketPath = join(directory, "t1.sock");
    const filePath = join(directory, "plain");
    await writeFile(filePath, "");

    // The runtime's own file-existence check answers FALSE for a socket, which is why this exists:
    // every terminal waited out its readiness timeout and was killed for never having started.
    expect(await Bun.file(socketPath).exists()).toBe(false);
    expect(socketIsBound(socketPath)).toBe(false);
    expect(socketIsBound(filePath)).toBe(false);
    expect(socketIsBound(join(directory, "absent"))).toBe(false);

    const server = Bun.listen({ unix: socketPath, socket: { data: () => undefined } });
    try {
      expect(socketIsBound(socketPath)).toBe(true);
      await awaitSocketBound(socketPath, 1_000);
    } finally {
      server.stop(true);
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("a socket that never appears gives up rather than waiting forever", async () => {
    await expect(awaitSocketBound(join(tmpdir(), "herdr-fleet-never.sock"), 60)).rejects.toThrow(
      "did not open its socket",
    );
  });
});
