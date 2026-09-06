import { describe, expect, test } from "bun:test";

import type { FleetTerminalConfig } from "../../config.ts";
import type { Resolution } from "../resolve.ts";
import type { TerminalServer, TimerHandle } from "../session.ts";
import { PeerTerminalService } from "./service.ts";

const CONFIG: FleetTerminalConfig = {
  bind: { host: "127.0.0.1", port: 18_903 },
  leadBind: { host: "127.0.0.1", port: 18_911 },
  serverPath: "/synthetic/fleet/bin/terminal-server",
  serverDigest: "0".repeat(64),
  idleSeconds: 3_600,
  maxServers: 2,
};

function harness(
  over: {
    readonly resolve?: (paneId: string) => Promise<Resolution>;
    readonly verified?: boolean;
    readonly config?: Partial<FleetTerminalConfig>;
    readonly startThrows?: boolean;
  } = {},
) {
  let clock = 1_000;
  const timers = new Map<number, { fn: () => void; due: number }>();
  let nextTimer = 1;
  const started: string[] = [];
  const stopped: string[] = [];
  const stoodDown: number[] = [];
  const verified: number[] = [];

  const service = new PeerTerminalService({
    config: { ...CONFIG, ...over.config },
    resolve:
      over.resolve ??
      (async (paneId) => ({
        ok: true,
        placement: { kind: "local", terminalId: `term_${paneId.replace(":", "")}`, paneId },
      })),
    verifyExecutable: async () => {
      verified.push(clock);
      return over.verified ?? true;
    },
    startServer: async (placement): Promise<TerminalServer> => {
      if (over.startThrows === true) throw new Error("the terminal server did not open its socket");
      const id = placement.kind === "local" ? placement.terminalId : placement.paneId;
      started.push(id);
      return {
        endpoint: `ws+unix:///run/${id}.sock:/ws`,
        stop: () => {
          stopped.push(id);
        },
      };
    },
    standDown: () => stoodDown.push(clock),
    now: () => clock,
    setTimer: (fn, ms) => {
      const id = nextTimer++;
      timers.set(id, { fn, due: clock + ms });
      return id;
    },
    clearTimer: (handle: TimerHandle) => {
      // SAFETY: this harness's own `setTimer` above returns the number it allocated, so every handle
      // reaching this function is one of those ids and nothing else can produce one.
      timers.delete(handle as number);
    },
  });

  return {
    service,
    started,
    stopped,
    stoodDown,
    verified,
    pending: () => timers.size,
    advance(seconds: number) {
      clock += seconds * 1_000;
      for (const [id, timer] of [...timers.entries()].toSorted((a, b) => a[1].due - b[1].due)) {
        if (timer.due <= clock) {
          timers.delete(id);
          timer.fn();
        }
      }
    },
  };
}

describe("a member that nobody is using", () => {
  test("holds nothing the moment it starts", () => {
    const h = harness();
    expect(h.service.held()).toBe(0);
    expect(h.started).toEqual([]);
    expect(h.service.state()).toEqual({ held: 0, idleSeconds: 3_600, maxServers: 2 });
  });

  test("stands down after its idle interval, and only then", () => {
    const h = harness();
    h.advance(3_599);
    expect(h.stoodDown).toEqual([]);
    h.advance(2);
    expect(h.stoodDown).toHaveLength(1);
  });

  test("a request restarts the clock", async () => {
    const h = harness();
    h.advance(3_000);
    await h.service.attach("w1:p1");
    h.service.close("w1:p1");
    h.advance(3_000);
    expect(h.stoodDown).toEqual([]);
    h.advance(601);
    expect(h.stoodDown).toHaveLength(1);
  });

  test("holding a terminal is never idle, however long ago it was asked for", async () => {
    const h = harness();
    await h.service.attach("w1:p1");
    h.advance(3_601);
    expect(h.stoodDown).toEqual([]);
    h.advance(3_601);
    expect(h.stoodDown).toEqual([]);
    // Once it is closed, the next interval ends it.
    h.service.close("w1:p1");
    h.advance(3_601);
    expect(h.stoodDown).toHaveLength(1);
  });
});

describe("serving a Pane", () => {
  test("starts exactly one terminal server, and a second ask reuses it", async () => {
    const h = harness();
    const first = await h.service.attach("w1:p1");
    const second = await h.service.attach("w1:p1");
    expect(first).toEqual({ ok: true, endpoint: "ws+unix:///run/term_w1p1.sock:/ws" });
    expect(second).toEqual(first);
    expect(h.started).toEqual(["term_w1p1"]);
    expect(h.service.held()).toBe(1);
  });

  test("verifies the executable before anything is started, every time it starts one", async () => {
    const h = harness();
    await h.service.attach("w1:p1");
    await h.service.attach("w1:p2");
    expect(h.verified).toHaveLength(2);
    expect(h.started).toHaveLength(2);
  });

  test("an executable that does not match refuses before a process exists", async () => {
    const h = harness({ verified: false });
    expect(await h.service.attach("w1:p1")).toEqual({ ok: false, reason: "executable-unverified" });
    expect(h.started).toEqual([]);
    expect(h.service.held()).toBe(0);
  });

  test.each([
    ["absent", "pane-absent"],
    ["ambiguous", "pane-ambiguous"],
    ["without a terminal", "no-terminal"],
    ["on an unreadable server", "snapshot-unavailable"],
  ] as const)("a Pane %s is refused, and nothing is started", async (_label, reason) => {
    const h = harness({ resolve: async () => ({ ok: false, reason }) });
    expect(await h.service.attach("w1:p1")).toEqual({ ok: false, reason });
    expect(h.started).toEqual([]);
  });

  test("re-resolves on every ask, so a Pane that has since closed refuses", async () => {
    let live = true;
    const h = harness({
      resolve: async () =>
        live
          ? { ok: true, placement: { kind: "local", terminalId: "term_abc", paneId: "w1:p1" } }
          : { ok: false, reason: "pane-absent" },
    });
    expect((await h.service.attach("w1:p1")).ok).toBe(true);
    h.service.close("w1:p1");
    live = false;
    expect(await h.service.attach("w1:p1")).toEqual({ ok: false, reason: "pane-absent" });
  });

  test("refuses beyond its configured maximum rather than growing past it", async () => {
    const h = harness();
    expect((await h.service.attach("w1:p1")).ok).toBe(true);
    expect((await h.service.attach("w1:p2")).ok).toBe(true);
    expect(await h.service.attach("w1:p3")).toEqual({ ok: false, reason: "at-capacity" });
    expect(h.started).toHaveLength(2);
  });

  test("a server that will not start is a refusal, not an exception", async () => {
    const h = harness({ startThrows: true });
    expect(await h.service.attach("w1:p1")).toEqual({ ok: false, reason: "server-unavailable" });
    expect(h.service.held()).toBe(0);
  });
});

describe("closing", () => {
  test("stops that Pane's server and no other", async () => {
    const h = harness();
    await h.service.attach("w1:p1");
    await h.service.attach("w1:p2");
    expect(h.service.close("w1:p1")).toBe(true);
    expect(h.stopped).toEqual(["term_w1p1"]);
    expect(h.service.held()).toBe(1);
  });

  test("a Pane that is not held is not an error", async () => {
    const h = harness();
    expect(h.service.close("w1:p9")).toBe(false);
    expect(h.stopped).toEqual([]);
  });

  test("stopping the service stops everything it started, once", async () => {
    const h = harness();
    await h.service.attach("w1:p1");
    await h.service.attach("w1:p2");
    h.service.stop();
    h.service.stop();
    expect(h.stopped.toSorted()).toEqual(["term_w1p1", "term_w1p2"]);
    expect(h.service.held()).toBe(0);
    expect(h.pending()).toBe(0);
    // And it serves nothing afterwards.
    expect(await h.service.attach("w1:p1")).toEqual({ ok: false, reason: "server-unavailable" });
  });
});
