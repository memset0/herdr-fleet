import { describe, expect, test } from "bun:test";

import type { TerminalTarget } from "./admit.ts";
import { TO_BROWSER, inputMessage, viewportMessage } from "./browser.ts";
import { CLIENT } from "./protocol.ts";
import type { Resolution } from "./resolve.ts";
import {
  NOTICE,
  TerminalConnection,
  TerminalConnections,
  type BrowserSocket,
  type ConnectionDeps,
  type ConnectionSession,
} from "./connection.ts";
import {
  TerminalSessions,
  type SessionDeps,
  type TerminalServer,
  type Upstream,
  type UpstreamHandlers,
} from "./session.ts";

const TARGET: TerminalTarget = { paneId: "w1:p1" };
// Far enough ahead that the sweep's own arithmetic never expires them; the expiry path has its
// own test, which states the clock it is judged against.
const SESSION: ConnectionSession = { sessionId: "session-1", issuedAt: 1_000, expiresAt: 4_000_000_000_000 };
const OTHER_SESSION: ConnectionSession = { sessionId: "session-2", issuedAt: 1_000, expiresAt: 4_000_000_000_000 };
const decoder = new TextDecoder();
const encoder = new TextEncoder();

/** The whole stack below a connection, with every process, socket and clock driven by hand. */
function harness(
  options: {
    readonly resolution?: Resolution;
    readonly resolveThrows?: boolean;
    readonly limits?: Partial<SessionDeps["limits"]>;
    readonly maxPendingInputBytes?: number;
  } = {},
) {
  let clock = 1_000;
  const timers = new Map<number, { fn: () => void; due: number }>();
  let nextTimer = 1;

  const started: string[] = [];
  const stopped: string[] = [];
  const sent: Uint8Array[] = [];
  const upstreams = new Map<string, UpstreamHandlers>();
  const resolved: TerminalTarget[] = [];

  const sessionDeps: SessionDeps = {
    limits: { graceMs: 5_000, maxSessions: 2, retainBytes: 64, ...options.limits },
    now: () => clock,
    setTimer: (fn, ms) => {
      const id = nextTimer++;
      timers.set(id, { fn, due: clock + ms });
      return id;
    },
    clearTimer: (handle) => {
      // SAFETY: this harness's own `setTimer` above returns the number it allocated, so every handle
      // reaching this function is one of those ids and nothing else can produce one.
      timers.delete(handle as number);
    },
    startServer: async (terminalId): Promise<TerminalServer> => {
      started.push(terminalId);
      return {
        endpoint: `unix:${terminalId}`,
        stop: () => {
          stopped.push(terminalId);
        },
      };
    },
    connect: async (server, _geometry, handlers): Promise<Upstream> => {
      const id = server.endpoint.replace("unix:", "");
      upstreams.set(id, handlers);
      return {
        send: (frame) => sent.push(frame),
        close: () => upstreams.delete(id),
      };
    },
  };

  const sessions = new TerminalSessions(sessionDeps);
  const deps: ConnectionDeps = {
    sessions,
    resolve: async (target: TerminalTarget): Promise<Resolution> => {
      resolved.push(target);
      if (options.resolveThrows === true) throw new Error("the snapshot is unavailable");
      return options.resolution ?? { ok: true, terminalId: "term_abc" };
    },
    maxPendingInputBytes: options.maxPendingInputBytes,
  };

  return {
    sessions,
    deps,
    started,
    stopped,
    resolved,
    /** Everything the Gateway sent upstream, as command bytes and payload text. */
    upstreamFrames: () =>
      sent.map((frame) => ({ command: frame[0], body: decoder.decode(frame.subarray(1)) })),
    emit(terminalId: string, data: Uint8Array) {
      upstreams.get(terminalId)?.onOutput(data);
    },
    upstreamClosed(terminalId: string) {
      upstreams.get(terminalId)?.onClosed();
    },
    advance(ms: number) {
      clock += ms;
      for (const [id, timer] of [...timers.entries()].toSorted((a, b) => a[1].due - b[1].due)) {
        if (timer.due <= clock) {
          timers.delete(id);
          timer.fn();
        }
      }
    },
    pendingTimers: () => timers.size,
  };
}

function socket() {
  const frames: Uint8Array[] = [];
  let closed = false;
  const handle: BrowserSocket = {
    send: (frame) => frames.push(frame),
    close: () => {
      closed = true;
    },
  };
  return {
    handle,
    frames,
    closed: () => closed,
    notices: () =>
      frames
        .filter((frame) => frame[0] === TO_BROWSER.notice)
        .map((frame) => decoder.decode(frame.subarray(1))),
    output: () =>
      Buffer.concat(
        frames.filter((frame) => frame[0] === TO_BROWSER.output).map((frame) => frame.subarray(1)),
      ).toString(),
  };
}

/** Opens a connection and drives it to `attached`, which every "while attached" test starts from. */
async function attached(options: Parameters<typeof harness>[0] = {}) {
  const h = harness(options);
  const s = socket();
  const connection = new TerminalConnection(TARGET, SESSION, s.handle, h.deps);
  connection.message(viewportMessage({ columns: 100, rows: 30 }));
  await Bun.sleep(0);
  return { h, s, connection };
}

describe("the first frame is the viewport", () => {
  test("a viewport establishes the session at exactly that size", async () => {
    const { h, connection } = await attached();
    expect(connection.status()).toBe("attached");
    expect(h.resolved).toEqual([TARGET]);
    expect(h.started).toEqual(["term_abc"]);
    // The size was carried into the start, so nothing had to be corrected afterwards.
    expect(h.upstreamFrames()).toEqual([]);
  });

  test("input before any viewport ends the connection rather than being buffered", async () => {
    const h = harness();
    const s = socket();
    const connection = new TerminalConnection(TARGET, SESSION, s.handle, h.deps);
    connection.message(inputMessage(encoder.encode("ls\n")));
    await Bun.sleep(0);
    expect(s.notices()).toEqual([NOTICE.protocol]);
    expect(s.closed()).toBe(true);
    expect(h.resolved).toEqual([]);
    expect(h.started).toEqual([]);
  });

  test("a resize arriving while the terminal is still starting is applied once it has", async () => {
    const h = harness();
    const s = socket();
    const connection = new TerminalConnection(TARGET, SESSION, s.handle, h.deps);
    connection.message(viewportMessage({ columns: 100, rows: 30 }));
    connection.message(viewportMessage({ columns: 120, rows: 40 }));
    await Bun.sleep(0);
    expect(connection.status()).toBe("attached");
    expect(h.upstreamFrames()).toEqual([
      { command: CLIENT.resize, body: JSON.stringify({ columns: 120, rows: 40 }) },
    ]);
  });
});

describe("what crosses while attached", () => {
  test("input is forwarded verbatim under the terminal's own input command", async () => {
    const { h, connection } = await attached();
    const arrowUp = new Uint8Array([0x1b, 0x5b, 0x41]);
    connection.message(inputMessage(arrowUp));
    expect(h.upstreamFrames()).toEqual([{ command: CLIENT.input, body: decoder.decode(arrowUp) }]);
  });

  test("a later viewport resizes the terminal", async () => {
    const { h, connection } = await attached();
    connection.message(viewportMessage({ columns: 132, rows: 43 }));
    expect(h.upstreamFrames()).toEqual([
      { command: CLIENT.resize, body: JSON.stringify({ columns: 132, rows: 43 }) },
    ]);
  });

  test("terminal output reaches the browser under the output command", async () => {
    const { h, s, connection } = await attached();
    expect(connection.status()).toBe("attached");
    h.emit("term_abc", encoder.encode("hello"));
    expect(s.output()).toBe("hello");
  });

  test("a third message kind is refused, not forwarded", async () => {
    const { h, s, connection } = await attached();
    connection.message(new Uint8Array([0x70, 0x01]));
    expect(h.upstreamFrames()).toEqual([]);
    expect(s.notices()).toEqual([NOTICE.protocol]);
    expect(s.closed()).toBe(true);
    expect(connection.status()).toBe("closed");
  });

  test("a viewport outside its bounds is refused rather than clamped, and nothing is forwarded", async () => {
    const { h, s, connection } = await attached();
    connection.message(viewportMessage({ columns: 5_000, rows: 30 }));
    expect(h.upstreamFrames()).toEqual([]);
    expect(s.notices()).toEqual([NOTICE.protocol]);
    expect(connection.status()).toBe("closed");
  });

  test("nothing crosses after the connection has ended", async () => {
    const { h, connection } = await attached();
    connection.end(NOTICE.ended);
    connection.message(inputMessage(encoder.encode("whoami\n")));
    expect(h.upstreamFrames()).toEqual([]);
  });
});

describe("what the browser is told when it cannot have a terminal", () => {
  test("a Pane with no terminal is unavailable, and no server is started", async () => {
    const h = harness({ resolution: { ok: false, reason: "no-terminal" } });
    const s = socket();
    const connection = new TerminalConnection(TARGET, SESSION, s.handle, h.deps);
    connection.message(viewportMessage({ columns: 100, rows: 30 }));
    await Bun.sleep(0);
    expect(s.notices()).toEqual([NOTICE.unavailable]);
    expect(h.started).toEqual([]);
  });

  test("a resolver that throws is a refusal, not an unhandled rejection", async () => {
    const h = harness({ resolveThrows: true });
    const s = socket();
    const connection = new TerminalConnection(TARGET, SESSION, s.handle, h.deps);
    connection.message(viewportMessage({ columns: 100, rows: 30 }));
    await Bun.sleep(0);
    expect(s.notices()).toEqual([NOTICE.unavailable]);
    expect(connection.status()).toBe("closed");
  });

  test("a second browser is told the terminal is busy, and the first is untouched", async () => {
    const { h, s, connection } = await attached();
    const second = socket();
    const other = new TerminalConnection(TARGET, OTHER_SESSION, second.handle, h.deps);
    other.message(viewportMessage({ columns: 100, rows: 30 }));
    await Bun.sleep(0);
    expect(second.notices()).toEqual([NOTICE.busy]);
    expect(second.closed()).toBe(true);
    // The established one neither hears about it nor loses its terminal.
    expect(connection.status()).toBe("attached");
    expect(s.notices()).toEqual([]);
    h.emit("term_abc", encoder.encode("still mine"));
    expect(s.output()).toBe("still mine");
    expect(h.started).toEqual(["term_abc"]);
  });
});

describe("input typed while the terminal was starting", () => {
  test("is delivered in order once it is attached", async () => {
    const h = harness();
    const s = socket();
    const connection = new TerminalConnection(TARGET, SESSION, s.handle, h.deps);
    connection.message(viewportMessage({ columns: 100, rows: 30 }));
    connection.message(inputMessage(encoder.encode("l")));
    connection.message(inputMessage(encoder.encode("s\n")));
    await Bun.sleep(0);
    expect(h.upstreamFrames()).toEqual([
      { command: CLIENT.input, body: "l" },
      { command: CLIENT.input, body: "s\n" },
    ]);
  });

  test("beyond its bound the connection ends rather than delivering part of it", async () => {
    const h = harness({ maxPendingInputBytes: 4 });
    const s = socket();
    const connection = new TerminalConnection(TARGET, SESSION, s.handle, h.deps);
    connection.message(viewportMessage({ columns: 100, rows: 30 }));
    connection.message(inputMessage(encoder.encode("abcdef")));
    await Bun.sleep(0);
    expect(s.notices()).toEqual([NOTICE.unavailable]);
    expect(h.upstreamFrames()).toEqual([]);
  });
});

describe("the browser leaving", () => {
  test("detaches without closing, so the session is held and the terminal keeps its size", async () => {
    const { h, connection } = await attached();
    connection.closed();
    expect(connection.status()).toBe("closed");
    // Held: the server is still running, and the grace timer is what will end it.
    expect(h.stopped).toEqual([]);
    expect(h.sessions.held("term_abc")).toBe(true);
    expect(h.pendingTimers()).toBe(1);
  });

  test("the grace period expiring is what stops the server and hands the size back", async () => {
    const { h, connection } = await attached();
    connection.closed();
    h.advance(4_999);
    expect(h.stopped).toEqual([]);
    h.advance(2);
    expect(h.stopped).toEqual(["term_abc"]);
    expect(h.sessions.held("term_abc")).toBe(false);
  });

  test("the terminal going away first tells the browser and closes the socket", async () => {
    const { h, s, connection } = await attached();
    h.upstreamClosed("term_abc");
    expect(s.notices()).toEqual([NOTICE.ended]);
    expect(s.closed()).toBe(true);
    expect(connection.status()).toBe("closed");
    expect(h.stopped).toEqual(["term_abc"]);
  });

  test("navigation, loss and a refusal all reach the same stop", async () => {
    for (const leave of ["closed", "end"] as const) {
      const { h, connection } = await attached();
      if (leave === "closed") connection.closed();
      else connection.end(NOTICE.ended);
      h.advance(6_000);
      expect(h.stopped).toEqual(["term_abc"]);
    }
  });
});

describe("a session that stops being current takes its terminals with it", () => {
  test("revoking one authenticated session closes only its connections", async () => {
    const first = await attached();
    const registry = new TerminalConnections();
    registry.add(first.connection);
    const second = socket();
    const other = new TerminalConnection({ paneId: "w1:p2" }, OTHER_SESSION, second.handle, first.h.deps);
    registry.add(other);

    expect(registry.closeForSession("session-2")).toBe(1);
    expect(second.notices()).toEqual([NOTICE.ended]);
    expect(first.connection.status()).toBe("attached");
    expect(registry.size()).toBe(1);
  });

  test("a sweep closes a connection the store no longer recognises", async () => {
    const { s, connection } = await attached();
    const registry = new TerminalConnections();
    registry.add(connection);
    expect(await registry.sweep(async () => true)).toBe(0);
    expect(connection.status()).toBe("attached");
    expect(await registry.sweep(async () => false)).toBe(1);
    expect(s.notices()).toEqual([NOTICE.ended]);
    expect(connection.status()).toBe("closed");
    expect(registry.size()).toBe(0);
  });

  test("an unreadable session store leaves a working terminal alone", async () => {
    const { connection } = await attached();
    const registry = new TerminalConnections();
    registry.add(connection);
    expect(
      await registry.sweep(async () => {
        throw new Error("the session file is not readable right now");
      }),
    ).toBe(0);
    expect(connection.status()).toBe("attached");
    expect(registry.size()).toBe(1);
  });

  test("an expiry already in the past needs no store to confirm it", async () => {
    const h = harness();
    const s = socket();
    const expired: ConnectionSession = { sessionId: "session-3", issuedAt: 1_000, expiresAt: 2_000 };
    const connection = new TerminalConnection(TARGET, expired, s.handle, h.deps);
    connection.message(viewportMessage({ columns: 100, rows: 30 }));
    await Bun.sleep(0);
    const registry = new TerminalConnections();
    registry.add(connection);
    let asked = false;
    const closed = await registry.sweep(async () => {
      asked = true;
      return true;
    }, 3_000);
    expect(closed).toBe(1);
    expect(asked).toBe(false);
    expect(s.notices()).toEqual([NOTICE.ended]);
  });

  test("closing them all leaves nothing open", async () => {
    const first = await attached();
    const registry = new TerminalConnections();
    registry.add(first.connection);
    registry.closeAll();
    expect(registry.size()).toBe(0);
    expect(first.s.closed()).toBe(true);
  });
});
