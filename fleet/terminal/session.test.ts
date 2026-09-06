import { describe, expect, test } from "bun:test";

import type { Geometry } from "./protocol.ts";
import {
  TerminalSessions,
  type AttachedClient,
  type SessionDeps,
  type TerminalServer,
  type Upstream,
  type UpstreamHandlers,
} from "./session.ts";

const GEOMETRY: Geometry = { columns: 100, rows: 30 };

/** A clock and timer set the test drives by hand, so a grace period is exact rather than awaited. */
function harness(over: Partial<SessionDeps["limits"]> = {}) {
  let clock = 1_000;
  const timers = new Map<number, { fn: () => void; due: number }>();
  let nextTimer = 1;

  const started: string[] = [];
  const stopped: string[] = [];
  const sent: Uint8Array[] = [];
  const upstreams = new Map<string, UpstreamHandlers>();
  let failNextStart = false;

  const deps: SessionDeps = {
    limits: { graceMs: 5_000, maxSessions: 2, retainBytes: 32, ...over },
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
      if (failNextStart) throw new Error("no terminal server today");
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

  return {
    deps,
    started,
    stopped,
    sent,
    sessions: new TerminalSessions(deps),
    /** Advance the clock and fire everything due, oldest first. */
    advance(ms: number) {
      clock += ms;
      for (const [id, timer] of [...timers.entries()].toSorted((a, b) => a[1].due - b[1].due)) {
        if (timer.due <= clock) {
          timers.delete(id);
          timer.fn();
        }
      }
    },
    /** Terminal output arriving from the far end. */
    emit(terminalId: string, data: Uint8Array) {
      upstreams.get(terminalId)?.onOutput(data);
    },
    /** The far end going away on its own — the Pane closed, or the server exited. */
    upstreamClosed(terminalId: string) {
      upstreams.get(terminalId)?.onClosed();
    },
    failStart() {
      failNextStart = true;
    },
    pendingTimers: () => timers.size,
  };
}

function client() {
  const written: Uint8Array[] = [];
  let closed = false;
  const handle: AttachedClient = {
    write: (data) => written.push(data),
    close: () => {
      closed = true;
    },
  };
  return { handle, written, closed: () => closed, text: () => Buffer.concat(written).toString() };
}

describe("holding a session past its browser", () => {
  test("returning within the grace period reuses it — nothing is re-established", async () => {
    const h = harness();
    const first = await h.sessions.acquire("term_a", GEOMETRY);
    const a = client();
    first.attach(a.handle);
    first.detach(a.handle);

    h.advance(1_000);
    const again = await h.sessions.acquire("term_a", GEOMETRY);
    expect(again).toBe(first);
    expect(h.started).toEqual(["term_a"]);
    expect(h.stopped).toEqual([]);
  });

  test("the grace period expiring closes the session, its server and its attachment", async () => {
    const h = harness();
    const session = await h.sessions.acquire("term_a", GEOMETRY);
    const a = client();
    session.attach(a.handle);
    session.detach(a.handle);

    h.advance(5_000);
    expect(h.stopped).toEqual(["term_a"]);
    expect(h.sessions.held("term_a")).toBe(false);
    expect(h.pendingTimers()).toBe(0);
  });

  test("returning after it expired establishes a new one, transparently", async () => {
    const h = harness();
    const first = await h.sessions.acquire("term_a", GEOMETRY);
    const a = client();
    first.attach(a.handle);
    first.detach(a.handle);
    h.advance(5_000);

    const second = await h.sessions.acquire("term_a", GEOMETRY);
    expect(second).not.toBe(first);
    expect(h.started).toEqual(["term_a", "term_a"]);
  });

  test("reattaching cancels the grace timer rather than leaving it to fire", async () => {
    const h = harness();
    const session = await h.sessions.acquire("term_a", GEOMETRY);
    const a = client();
    session.attach(a.handle);
    session.detach(a.handle);
    expect(h.pendingTimers()).toBe(1);

    const b = client();
    session.attach(b.handle);
    expect(h.pendingTimers()).toBe(0);
    h.advance(60_000);
    expect(h.stopped).toEqual([]);
    expect(h.sessions.held("term_a")).toBe(true);
  });
});

describe("the bound on how many a device holds", () => {
  test("a new session at the maximum closes the least recently used one", async () => {
    const h = harness({ maxSessions: 2 });
    const a = await h.sessions.acquire("term_a", GEOMETRY);
    h.advance(10);
    await h.sessions.acquire("term_b", GEOMETRY);
    h.advance(10);
    // Touching A makes B the oldest.
    await h.sessions.acquire("term_a", GEOMETRY);
    h.advance(10);

    await h.sessions.acquire("term_c", GEOMETRY);
    expect(h.stopped).toEqual(["term_b"]);
    expect(h.sessions.held("term_a")).toBe(true);
    expect(h.sessions.held("term_c")).toBe(true);
    expect(a).toBe(await h.sessions.acquire("term_a", GEOMETRY));
  });

  test("eviction closes the evicted server, and never another session's", async () => {
    const h = harness({ maxSessions: 1 });
    await h.sessions.acquire("term_a", GEOMETRY);
    await h.sessions.acquire("term_b", GEOMETRY);
    expect(h.stopped).toEqual(["term_a"]);
    expect(h.sessions.size()).toBe(1);
    expect(h.sessions.held("term_b")).toBe(true);
  });

  test("a device must be allowed at least one", () => {
    const h = harness();
    expect(() => new TerminalSessions({ ...h.deps, limits: { ...h.deps.limits, maxSessions: 0 } }))
      .toThrow();
  });
});

describe("one writable client", () => {
  test("a second attach is refused without displacing or exposing the first", async () => {
    const h = harness();
    const session = await h.sessions.acquire("term_a", GEOMETRY);
    const a = client();
    const b = client();
    expect(session.attach(a.handle)).toEqual({ ok: true });
    expect(session.attach(b.handle)).toEqual({ ok: false, reason: "busy" });

    h.emit("term_a", new TextEncoder().encode("secret"));
    expect(a.text()).toBe("secret");
    expect(b.written).toHaveLength(0);
    expect(a.closed()).toBe(false);
  });

  test("the terminal is available again once the first client leaves", async () => {
    const h = harness();
    const session = await h.sessions.acquire("term_a", GEOMETRY);
    const a = client();
    const b = client();
    session.attach(a.handle);
    session.detach(a.handle);
    expect(session.attach(b.handle)).toEqual({ ok: true });
  });

  test("a detach from a client that is not attached changes nothing", async () => {
    const h = harness();
    const session = await h.sessions.acquire("term_a", GEOMETRY);
    const a = client();
    const b = client();
    session.attach(a.handle);
    session.detach(b.handle);
    expect(session.hasClient()).toBe(true);
    expect(h.pendingTimers()).toBe(0);
  });
});

describe("what a returning browser is given", () => {
  test("a first attach replays nothing — the multiplexer's own repaint is coming", async () => {
    const h = harness();
    const session = await h.sessions.acquire("term_a", GEOMETRY);
    const a = client();
    session.attach(a.handle);
    expect(a.written).toHaveLength(0);
  });

  test("a reattach to a held session replays the retained window first", async () => {
    const h = harness();
    const session = await h.sessions.acquire("term_a", GEOMETRY);
    const a = client();
    session.attach(a.handle);
    h.emit("term_a", new TextEncoder().encode("hello "));
    h.emit("term_a", new TextEncoder().encode("world"));
    session.detach(a.handle);

    const b = client();
    session.attach(b.handle);
    expect(b.text()).toBe("hello world");
  });

  test("retained output stays within its bound, oldest discarded", async () => {
    const h = harness({ retainBytes: 8 });
    const session = await h.sessions.acquire("term_a", GEOMETRY);
    const a = client();
    session.attach(a.handle);
    h.emit("term_a", new TextEncoder().encode("0123456789"));
    session.detach(a.handle);

    const b = client();
    session.attach(b.handle);
    expect(b.text()).toBe("23456789");
  });

  test("output arriving with nobody attached is still retained", async () => {
    const h = harness();
    const session = await h.sessions.acquire("term_a", GEOMETRY);
    const a = client();
    session.attach(a.handle);
    session.detach(a.handle);
    h.emit("term_a", new TextEncoder().encode("while away"));

    const b = client();
    session.attach(b.handle);
    expect(b.text()).toBe("while away");
  });

  test("a closed session's screen cannot be inherited by its successor", async () => {
    const h = harness();
    const first = await h.sessions.acquire("term_a", GEOMETRY);
    const a = client();
    first.attach(a.handle);
    h.emit("term_a", new TextEncoder().encode("previous"));
    first.detach(a.handle);
    h.advance(5_000);

    const second = await h.sessions.acquire("term_a", GEOMETRY);
    const b = client();
    second.attach(b.handle);
    expect(b.written).toHaveLength(0);
  });
});

describe("the far end going away", () => {
  test("closes the session and the attached client with it", async () => {
    const h = harness();
    const session = await h.sessions.acquire("term_a", GEOMETRY);
    const a = client();
    session.attach(a.handle);
    h.upstreamClosed("term_a");
    expect(a.closed()).toBe(true);
    expect(h.stopped).toEqual(["term_a"]);
    expect(h.sessions.held("term_a")).toBe(false);
  });

  test("a server that will not start leaves nothing held", async () => {
    const h = harness();
    h.failStart();
    await expect(h.sessions.acquire("term_a", GEOMETRY)).rejects.toThrow();
    expect(h.sessions.size()).toBe(0);
  });

  test("closing twice is harmless", async () => {
    const h = harness();
    const session = await h.sessions.acquire("term_a", GEOMETRY);
    session.close();
    session.close();
    expect(h.stopped).toEqual(["term_a"]);
  });

  test("closing all leaves nothing running", async () => {
    const h = harness({ maxSessions: 4 });
    await h.sessions.acquire("term_a", GEOMETRY);
    await h.sessions.acquire("term_b", GEOMETRY);
    h.sessions.closeAll();
    expect(h.stopped.toSorted()).toEqual(["term_a", "term_b"]);
    expect(h.sessions.size()).toBe(0);
  });
});
