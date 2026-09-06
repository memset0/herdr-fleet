import { describe, expect, test } from "bun:test";

import {
  ATTACH_COMMAND_NAME,
  SERVER_WS_PATH,
  SERVER_WS_PROTOCOL,
  TERMINAL_SERVER_NAME,
  findTerminalTools,
  makeStartServer,
  serverUrl,
  terminalServerArguments,
  type SpawnedChild,
  type TerminalTools,
} from "./spawn.ts";

const TOOLS: TerminalTools = { server: "/synthetic/bin/ttyd", attach: "/synthetic/bin/herdr" };
const GEOMETRY = { columns: 100, rows: 30 };

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
    const first = await start("term_../../etc/passwd", GEOMETRY);
    const second = await start("term_bbb", GEOMETRY);
    expect(first.endpoint).toBe("/run/socket/t1.sock");
    expect(second.endpoint).toBe("/run/socket/t2.sock");
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
    const server = await start("term_abc", GEOMETRY);
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
    await expect(start("term_abc", GEOMETRY)).rejects.toThrow("did not open its socket");
    expect(h.killed).toEqual([0]);
  });
});
