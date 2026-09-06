import { describe, expect, test } from "bun:test";

import { NOTICE, type BrowserSocket, type ConnectionSession } from "./connection.ts";
import {
  FLEET_TERMINAL_LIMITS,
  FLEET_TERMINAL_LIMIT_BOUNDS,
  TerminalService,
  createTerminalService,
  validateLimits,
} from "./service.ts";

const SESSION: ConnectionSession = { sessionId: "s1", issuedAt: 1_000, expiresAt: 4_000_000_000_000 };
const OTHER: ConnectionSession = { sessionId: "s2", issuedAt: 1_000, expiresAt: 4_000_000_000_000 };

interface FakeSocket {
  readonly handle: BrowserSocket;
  readonly notices: () => string[];
  readonly closed: () => boolean;
}

function socket(): FakeSocket {
  const frames: Uint8Array[] = [];
  let closed = false;
  const decoder = new TextDecoder();
  return {
    handle: {
      send: (frame) => frames.push(frame),
      close: () => {
        closed = true;
      },
    },
    notices: () => frames.filter((frame) => frame[0] === 0x6e).map((frame) => decoder.decode(frame.subarray(1))),
    closed: () => closed,
  };
}

function service(over: { isActive?: (session: ConnectionSession) => Promise<boolean>; sweepMs?: number } = {}) {
  const removed: string[] = [];
  const scheduled: { ms: number; fn: () => void }[] = [];
  const stopped: number[] = [];
  const instance = new TerminalService({
    tools: { server: "/synthetic/bin/ttyd", attach: "/synthetic/bin/herdr" },
    socketDir: {
      path: "/synthetic/run",
      remove: async () => {
        removed.push("/synthetic/run");
      },
    },
    resolve: async () => ({ ok: true, placement: { kind: "local", terminalId: "term_abc", paneId: "w1:p1" } }),
    isActive: over.isActive ?? (async () => true),
    sweepMs: over.sweepMs,
    setInterval: (fn, ms) => {
      const index = scheduled.length;
      scheduled.push({ ms, fn });
      return { stop: () => stopped.push(index) };
    },
  });
  return { instance, removed, scheduled, stopped };
}

describe("the numbers, and their bounds", () => {
  test("the shipped limits are inside the bounds they are validated against", () => {
    expect(validateLimits(FLEET_TERMINAL_LIMITS)).toBe(FLEET_TERMINAL_LIMITS);
  });

  test("the grace period is short, because it holds somebody else's terminal at somebody else's size", () => {
    expect(FLEET_TERMINAL_LIMITS.graceMs).toBeLessThanOrEqual(30_000);
  });

  test("the retained window fits one repaint of the largest geometry this surface admits", () => {
    // 500 columns by 200 rows, and room for the attributes around them.
    expect(FLEET_TERMINAL_LIMITS.retainBytes).toBeGreaterThanOrEqual(500 * 200);
  });

  test("a value outside its bound is refused, by name", () => {
    for (const field of ["graceMs", "maxSessions", "retainBytes"] as const) {
      const { minimum, maximum } = FLEET_TERMINAL_LIMIT_BOUNDS[field];
      expect(() => validateLimits({ ...FLEET_TERMINAL_LIMITS, [field]: minimum - 1 })).toThrow(field);
      expect(() => validateLimits({ ...FLEET_TERMINAL_LIMITS, [field]: maximum + 1 })).toThrow(field);
      expect(() => validateLimits({ ...FLEET_TERMINAL_LIMITS, [field]: minimum + 0.5 })).toThrow(field);
    }
  });
});

describe("a deployment without the executables", () => {
  test("offers no terminals rather than half of one", async () => {
    expect(await createTerminalService({ resolve: async () => ({ ok: false, reason: "no-terminal" }), isActive: async () => true, which: () => null })).toBeNull();
    expect(
      await createTerminalService({
        resolve: async () => ({ ok: false, reason: "no-terminal" }),
        isActive: async () => true,
        which: (name) => (name === "ttyd" ? "/synthetic/bin/ttyd" : null),
      }),
    ).toBeNull();
  });
});

describe("what the service holds", () => {
  test("an opened connection is registered, and leaving removes it", () => {
    const { instance } = service();
    const s = socket();
    const connection = instance.open({ target: { paneId: "w1:p1" }, session: SESSION }, s.handle);
    expect(instance.connections.size()).toBe(1);
    instance.closed(connection);
    expect(instance.connections.size()).toBe(0);
  });

  test("a revoked session closes its own connections and no others", () => {
    const { instance } = service();
    const mine = socket();
    const theirs = socket();
    instance.open({ target: { paneId: "w1:p1" }, session: SESSION }, mine.handle);
    instance.open({ target: { paneId: "w1:p2" }, session: OTHER }, theirs.handle);
    expect(instance.revoked(SESSION.sessionId)).toBe(1);
    expect(mine.notices()).toEqual([NOTICE.ended]);
    expect(theirs.notices()).toEqual([]);
    expect(instance.connections.size()).toBe(1);
  });

  test("the sweep runs on its own interval and asks the store", async () => {
    let asked = 0;
    const { instance, scheduled } = service({
      sweepMs: 1_234,
      isActive: async () => {
        asked += 1;
        return false;
      },
    });
    const s = socket();
    instance.open({ target: { paneId: "w1:p1" }, session: SESSION }, s.handle);
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0]!.ms).toBe(1_234);
    expect(await instance.sweep()).toBe(1);
    expect(asked).toBe(1);
    expect(s.notices()).toEqual([NOTICE.ended]);
  });

  test("stopping ends every connection, every session, the timer and the directory", async () => {
    const { instance, removed, stopped } = service();
    const s = socket();
    instance.open({ target: { paneId: "w1:p1" }, session: SESSION }, s.handle);
    await instance.stop();
    expect(s.closed()).toBe(true);
    expect(instance.connections.size()).toBe(0);
    expect(instance.sessions.size()).toBe(0);
    expect(stopped).toEqual([0]);
    expect(removed).toEqual(["/synthetic/run"]);
  });
});
