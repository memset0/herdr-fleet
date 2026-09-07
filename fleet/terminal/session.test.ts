import { describe, expect, test } from "bun:test";

import { placementKey, type Placement } from "./placement.ts";
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

/** Every session in this file is a local terminal; the key is what the set actually holds it by. */
const at = (terminalId: string): Placement => ({ kind: "local", terminalId, paneId: "w1:p1" });
const key = (terminalId: string): string => placementKey(at(terminalId));

async function acquired(sessions: TerminalSessions, placement: Placement, geometry: Geometry) {
  const lease = await sessions.acquire(placement, geometry);
  lease.release();
  return lease.session;
}

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
    startServer: async (placement): Promise<TerminalServer> => {
      if (failNextStart) throw new Error("no terminal server today");
      const terminalId = placement.kind === "local" ? placement.terminalId : placement.paneId;
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
    const first = await acquired(h.sessions, at("term_a"), GEOMETRY);
    const a = client();
    first.attach(a.handle);
    first.detach(a.handle);

    h.advance(1_000);
    const again = await acquired(h.sessions, at("term_a"), GEOMETRY);
    expect(again).toBe(first);
    expect(h.started).toEqual(["term_a"]);
    expect(h.stopped).toEqual([]);
  });

  test("the grace period expiring closes the session, its server and its attachment", async () => {
    const h = harness();
    const session = await acquired(h.sessions, at("term_a"), GEOMETRY);
    const a = client();
    session.attach(a.handle);
    session.detach(a.handle);

    h.advance(5_000);
    expect(h.stopped).toEqual(["term_a"]);
    expect(h.sessions.held(key("term_a"))).toBe(false);
    expect(h.pendingTimers()).toBe(0);
  });

  test("returning after it expired establishes a new one, transparently", async () => {
    const h = harness();
    const first = await acquired(h.sessions, at("term_a"), GEOMETRY);
    const a = client();
    first.attach(a.handle);
    first.detach(a.handle);
    h.advance(5_000);

    const second = await acquired(h.sessions, at("term_a"), GEOMETRY);
    expect(second).not.toBe(first);
    expect(h.started).toEqual(["term_a", "term_a"]);
  });

  test("reattaching cancels the grace timer rather than leaving it to fire", async () => {
    const h = harness();
    const session = await acquired(h.sessions, at("term_a"), GEOMETRY);
    const a = client();
    session.attach(a.handle);
    session.detach(a.handle);
    expect(h.pendingTimers()).toBe(1);

    const b = client();
    session.attach(b.handle);
    expect(h.pendingTimers()).toBe(0);
    h.advance(60_000);
    expect(h.stopped).toEqual([]);
    expect(h.sessions.held(key("term_a"))).toBe(true);
  });
});

describe("the bound on how many a device holds", () => {
  test("a new session at the maximum closes the least recently used one", async () => {
    const h = harness({ maxSessions: 2 });
    const a = await acquired(h.sessions, at("term_a"), GEOMETRY);
    h.advance(10);
    await acquired(h.sessions, at("term_b"), GEOMETRY);
    h.advance(10);
    // Touching A makes B the oldest.
    await acquired(h.sessions, at("term_a"), GEOMETRY);
    h.advance(10);

    await acquired(h.sessions, at("term_c"), GEOMETRY);
    expect(h.stopped).toEqual(["term_b"]);
    expect(h.sessions.held(key("term_a"))).toBe(true);
    expect(h.sessions.held(key("term_c"))).toBe(true);
    expect(a).toBe(await acquired(h.sessions, at("term_a"), GEOMETRY));
  });

  test("eviction closes the evicted server, and never another session's", async () => {
    const h = harness({ maxSessions: 1 });
    await acquired(h.sessions, at("term_a"), GEOMETRY);
    await acquired(h.sessions, at("term_b"), GEOMETRY);
    expect(h.stopped).toEqual(["term_a"]);
    expect(h.sessions.size()).toBe(1);
    expect(h.sessions.held(key("term_b"))).toBe(true);
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
    const session = await acquired(h.sessions, at("term_a"), GEOMETRY);
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
    const session = await acquired(h.sessions, at("term_a"), GEOMETRY);
    const a = client();
    const b = client();
    session.attach(a.handle);
    session.detach(a.handle);
    expect(session.attach(b.handle)).toEqual({ ok: true });
  });

  test("a detach from a client that is not attached changes nothing", async () => {
    const h = harness();
    const session = await acquired(h.sessions, at("term_a"), GEOMETRY);
    const a = client();
    const b = client();
    session.attach(a.handle);
    session.detach(b.handle);
    expect(session.hasClient()).toBe(true);
    expect(h.pendingTimers()).toBe(0);
  });
});

describe("what a returning browser is given", () => {
  test("a reattach to a held session replays the retained window first", async () => {
    const h = harness();
    const session = await acquired(h.sessions, at("term_a"), GEOMETRY);
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
    const session = await acquired(h.sessions, at("term_a"), GEOMETRY);
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
    const session = await acquired(h.sessions, at("term_a"), GEOMETRY);
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
    const first = await acquired(h.sessions, at("term_a"), GEOMETRY);
    const a = client();
    first.attach(a.handle);
    h.emit("term_a", new TextEncoder().encode("previous"));
    first.detach(a.handle);
    h.advance(5_000);

    const second = await acquired(h.sessions, at("term_a"), GEOMETRY);
    const b = client();
    second.attach(b.handle);
    expect(b.written).toHaveLength(0);
  });
});

describe("the far end going away", () => {
  test("closes the session and the attached client with it", async () => {
    const h = harness();
    const session = await acquired(h.sessions, at("term_a"), GEOMETRY);
    const a = client();
    session.attach(a.handle);
    h.upstreamClosed("term_a");
    expect(a.closed()).toBe(true);
    expect(h.stopped).toEqual(["term_a"]);
    expect(h.sessions.held(key("term_a"))).toBe(false);
  });

  test("a server that will not start leaves nothing held", async () => {
    const h = harness();
    h.failStart();
    await expect(h.sessions.acquire(at("term_a"), GEOMETRY)).rejects.toThrow();
    expect(h.sessions.size()).toBe(0);
  });

  test("closing twice is harmless", async () => {
    const h = harness();
    const session = await acquired(h.sessions, at("term_a"), GEOMETRY);
    session.close();
    session.close();
    expect(h.stopped).toEqual(["term_a"]);
  });

  test("closing all leaves nothing running", async () => {
    const h = harness({ maxSessions: 4 });
    await acquired(h.sessions, at("term_a"), GEOMETRY);
    await acquired(h.sessions, at("term_b"), GEOMETRY);
    h.sessions.closeAll();
    expect(h.stopped.toSorted()).toEqual(["term_a", "term_b"]);
    expect(h.sessions.size()).toBe(0);
  });
});

describe("concurrent establishment", () => {
  test("shares one startup while two acquisitions wait for the same placement", async () => {
    const h = harness();
    const barrier = Promise.withResolvers<void>();
    const entered = Promise.withResolvers<void>();
    let starts = 0;
    const sessions = new TerminalSessions({
      ...h.deps,
      startServer: async (placement, geometry) => {
        starts += 1;
        entered.resolve();
        await barrier.promise;
        return h.deps.startServer(placement, geometry);
      },
    });
    const first = sessions.acquire(at("term_a"), GEOMETRY);
    const second = sessions.acquire(at("term_a"), GEOMETRY);
    try {
      await entered.promise;
      expect(starts).toBe(1);
    } finally {
      barrier.resolve();
      await Promise.allSettled([first, second]);
      await sessions.closeAll();
    }
  });
});

describe("ownership across asynchronous boundaries", () => {
  test("waits for the shared upstream and preserves output received during connection", async () => {
    const h = harness();
    const connecting = Promise.withResolvers<void>();
    const finish = Promise.withResolvers<void>();
    let connects = 0;
    const sessions = new TerminalSessions({
      ...h.deps,
      connect: async (server, geometry, handlers) => {
        connects += 1;
        connecting.resolve();
        handlers.onOutput(new TextEncoder().encode("initial screen"));
        await finish.promise;
        return h.deps.connect(server, geometry, handlers);
      },
    });
    let resolved = 0;
    const first = sessions.acquire(at("term_a"), GEOMETRY).then((lease) => { resolved += 1; return lease; });
    await connecting.promise;
    const second = sessions.acquire(at("term_a"), GEOMETRY).then((lease) => { resolved += 1; return lease; });
    expect(resolved).toBe(0);
    finish.resolve();
    const [a, b] = await Promise.all([first, second]);
    expect(connects).toBe(1);
    expect(a.session).toBe(b.session);
    const reader = client();
    a.session.attach(reader.handle);
    expect(reader.text()).toBe("initial screen");
    a.release();
    b.release();
    await sessions.closeAll();
  });

  test("a shared connect failure stops its server and a later attempt succeeds", async () => {
    const h = harness();
    const connecting = Promise.withResolvers<void>();
    const fail = Promise.withResolvers<void>();
    let calls = 0;
    const sessions = new TerminalSessions({
      ...h.deps,
      connect: async (server, geometry, handlers) => {
        if (calls++ === 0) {
          connecting.resolve();
          await fail.promise;
        }
        return h.deps.connect(server, geometry, handlers);
      },
    });
    const first = sessions.acquire(at("term_a"), GEOMETRY);
    const second = sessions.acquire(at("term_a"), GEOMETRY);
    const results = Promise.allSettled([first, second]);
    await connecting.promise;
    fail.reject(new Error("connection refused"));
    expect((await results).map((result) => result.status)).toEqual(["rejected", "rejected"]);
    expect(h.stopped).toEqual(["term_a"]);
    expect(sessions.size()).toBe(0);
    const retry = await sessions.acquire(at("term_a"), GEOMETRY);
    expect(retry.session.attach(client().handle)).toEqual({ ok: true });
    expect(h.started).toEqual(["term_a", "term_a"]);
    retry.release();
    await sessions.closeAll();
  });

  test("one caller releases only its interest and the last release starts grace once", async () => {
    const h = harness();
    const [first, second] = await Promise.all([
      h.sessions.acquire(at("term_a"), GEOMETRY),
      h.sessions.acquire(at("term_a"), GEOMETRY),
    ]);
    first.release();
    first.release();
    h.advance(10_000);
    expect(h.stopped).toEqual([]);
    expect(h.pendingTimers()).toBe(0);
    second.release();
    h.advance(4_000);
    second.release();
    h.advance(1_000);
    expect(h.stopped).toEqual(["term_a"]);
  });

  test("pending starts occupy capacity without serializing work below the limit", async () => {
    const h = harness({ maxSessions: 2 });
    const started = Promise.withResolvers<void>();
    const finish = Promise.withResolvers<void>();
    const calls: string[] = [];
    const sessions = new TerminalSessions({
      ...h.deps,
      startServer: async (placement, geometry) => {
        calls.push(placementKey(placement));
        if (calls.length === 2) started.resolve();
        await finish.promise;
        return h.deps.startServer(placement, geometry);
      },
    });
    const first = sessions.acquire(at("term_a"), GEOMETRY);
    const second = sessions.acquire(at("term_b"), GEOMETRY);
    const third = sessions.acquire(at("term_c"), GEOMETRY);
    await started.promise;
    expect(calls).toEqual([key("term_a"), key("term_b")]);
    expect(sessions.size()).toBe(2);
    finish.resolve();
    const [a, b] = await Promise.all([first, second]);
    expect(calls).toHaveLength(2);
    a.release();
    const c = await third;
    expect(h.stopped).toEqual(["term_a"]);
    expect(sessions.size()).toBe(2);
    expect(b.session.attach(client().handle)).toEqual({ ok: true });
    b.release();
    c.release();
    await sessions.closeAll();
  });

  test("a rejected startup frees its slot for another waiting placement", async () => {
    const h = harness({ maxSessions: 1 });
    const entered = Promise.withResolvers<void>();
    const finish = Promise.withResolvers<void>();
    const sessions = new TerminalSessions({
      ...h.deps,
      startServer: async (placement, geometry) => {
        if (placementKey(placement) === key("term_a")) {
          entered.resolve();
          await finish.promise;
        }
        return h.deps.startServer(placement, geometry);
      },
    });
    const first = sessions.acquire(at("term_a"), GEOMETRY);
    const rejected = Promise.allSettled([first]);
    const second = sessions.acquire(at("term_b"), GEOMETRY);
    await entered.promise;
    finish.reject(new Error("start refused"));
    expect((await rejected)[0]?.status).toBe("rejected");
    const b = await second;
    expect(h.started).toEqual(["term_b"]);
    b.release();
    await sessions.closeAll();
  });

  test("shutdown stops a late server before connecting and rejects queued work", async () => {
    const h = harness({ maxSessions: 1 });
    const entered = Promise.withResolvers<void>();
    const finish = Promise.withResolvers<void>();
    let connects = 0;
    const sessions = new TerminalSessions({
      ...h.deps,
      startServer: async (placement, geometry) => {
        entered.resolve();
        await finish.promise;
        return h.deps.startServer(placement, geometry);
      },
      connect: async (server, geometry, handlers) => {
        connects += 1;
        return h.deps.connect(server, geometry, handlers);
      },
    });
    const results = Promise.allSettled([
      sessions.acquire(at("term_a"), GEOMETRY),
      sessions.acquire(at("term_b"), GEOMETRY),
    ]);
    await entered.promise;
    const stopped = sessions.closeAll();
    expect(sessions.closeAll()).toBe(stopped);
    finish.resolve();
    await stopped;
    expect((await results).map((result) => result.status)).toEqual(["rejected", "rejected"]);
    expect(connects).toBe(0);
    expect(h.stopped).toEqual(["term_a"]);
    expect(sessions.size()).toBe(0);
    await expect(sessions.acquire(at("term_c"), GEOMETRY)).rejects.toThrow();
  });

  test("shutdown closes an upstream returned after the session already ended", async () => {
    const h = harness();
    const entered = Promise.withResolvers<void>();
    const finish = Promise.withResolvers<void>();
    let upstreamClosed = 0;
    const sessions = new TerminalSessions({
      ...h.deps,
      connect: async () => {
        entered.resolve();
        await finish.promise;
        return { send: () => undefined, close: () => { upstreamClosed += 1; } };
      },
    });
    const result = Promise.allSettled([sessions.acquire(at("term_a"), GEOMETRY)]);
    await entered.promise;
    const stopped = sessions.closeAll();
    finish.resolve();
    await stopped;
    expect((await result)[0]?.status).toBe("rejected");
    expect(upstreamClosed).toBe(1);
    expect(h.stopped).toEqual(["term_a"]);
    expect(sessions.size()).toBe(0);
  });

  test("an old close callback cannot remove the replacement or supply its output", async () => {
    const h = harness();
    const handlers: UpstreamHandlers[] = [];
    const sessions = new TerminalSessions({
      ...h.deps,
      connect: async (server, geometry, events) => {
        handlers.push(events);
        return h.deps.connect(server, geometry, events);
      },
    });
    const first = await sessions.acquire(at("term_a"), GEOMETRY);
    first.session.close();
    first.release();
    const next = await sessions.acquire(at("term_a"), GEOMETRY);
    handlers[0]!.onClosed();
    handlers[0]!.onOutput(new TextEncoder().encode("old output"));
    const reader = client();
    expect(next.session.attach(reader.handle)).toEqual({ ok: true });
    expect(reader.text()).toBe("");
    expect(sessions.held(key("term_a"))).toBe(true);
    next.release();
    await sessions.closeAll();
  });
});
