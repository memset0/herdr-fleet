import { describe, expect, test } from "bun:test";

import { FleetCollector } from "./fleet.ts";
import { TransportRegistry, type TransportStatus } from "./transports.ts";
import { gatewayConfig } from "./test-helpers.ts";

function agent(
  paneId: string,
  status: "idle" | "working" | "blocked" | "done" | "unknown" = "idle",
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    paneId,
    workspaceId: "w0",
    workspaceLabel: "Example project",
    workspaceNumber: 0,
    tabId: "w0:t0",
    tabLabel: "Main",
    agent: "codex",
    status,
    cwd: "/srv/example-project",
    focused: false,
    lastActiveAt: 40,
    lastSeenAt: 20,
    ...extra,
  };
}

function session(
  name: string,
  options: Partial<{ isPrimary: boolean; reachable: boolean; agents: number; working: number; blocked: number }> = {},
) {
  return {
    name,
    isPrimary: options.isPrimary ?? false,
    reachable: options.reachable ?? true,
    agents: options.agents ?? 1,
    working: options.working ?? 0,
    blocked: options.blocked ?? 0,
  };
}

function response(agents: Record<string, unknown>[], sessions = [session("default", { isPrimary: true })], bridge = "connected") {
  const workspaces = [...new Map(agents.map((entry) => [String(entry.workspaceId), {
    workspaceId: entry.workspaceId,
    number: entry.workspaceNumber,
    label: entry.workspaceLabel,
    focused: false,
    activeTabId: entry.tabId,
    tabCount: 1,
    paneCount: agents.filter((candidate) => candidate.workspaceId === entry.workspaceId).length,
  }])).values()];
  const tabs = [...new Map(agents.map((entry) => [String(entry.tabId), {
    tabId: entry.tabId,
    workspaceId: entry.workspaceId,
    number: 0,
    label: entry.tabLabel ?? "Main",
    focused: false,
    paneCount: agents.filter((candidate) => candidate.tabId === entry.tabId).length,
  }])).values()];
  return new Response(JSON.stringify({ bridge, sessions, agents, shellPanes: [], workspaces, tabs, ts: 50 }), {
    headers: { "content-type": "application/json" },
  });
}

describe("Fleet aggregation", () => {
  test("projects safe Agent cards across primary and named sessions", async () => {
    const config = gatewayConfig();
    config.nodes[0]!.fallbackUrl = "https://fleet.example.com/ttyd/local/";
    const transports = new TransportRegistry(config.nodes);
    const fetcher = (async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.searchParams.get("session") === "batch demo") {
        return response([agent("w1:p2", "working", { workspaceLabel: "Batch" })]);
      }
      return response(
        [agent("w0:p1", "blocked", { terminal: "must not be exposed", authorization: "synthetic-secret" })],
        [
          session("default", { isPrimary: true, blocked: 1 }),
          session("batch demo", { working: 1 }),
        ],
      );
    }) as typeof fetch;
    const collector = new FleetCollector(config, transports, fetcher, () => 100);

    await collector.refresh();

    const state = collector.snapshot();
    expect(state.totals).toEqual({ nodes: 1, online: 1, agents: 2, working: 1, blocked: 1 });
    expect(state.refresh).toEqual({
      baseMs: 5_000,
      maxMs: 3_600_000,
      minNodeRevisitMs: 5_000,
      delayMs: 5_000,
      nextAt: 5_100,
    });
    expect(state.nodes[0]?.sessions.map((entry) => entry.name)).toEqual(["default", "batch demo"]);
    expect(state.nodes[0]?.fallbackUrl).toBe("https://fleet.example.com/ttyd/local/");
    expect(state.nodes[0]?.agentEntries.map((entry) => [entry.paneId, entry.herdrSession, entry.reachable])).toEqual([
      ["w1:p2", "batch demo", true],
      ["w0:p1", "default", true],
    ]);
    expect(state.nodes[0]?.agentEntries[1]).toEqual({
      paneId: "w0:p1",
      workspaceId: "w0",
      workspaceLabel: "Example project",
      workspaceNumber: 0,
      tabId: "w0:t0",
      tabLabel: "Main",
      agent: "codex",
      status: "blocked",
      cwd: "/srv/example-project",
      focused: false,
      lastActiveAt: 40,
      lastSeenAt: 20,
      herdrSession: "default",
      primarySession: true,
      reachable: true,
      observedAt: 100,
    });
    expect(JSON.stringify(state)).not.toContain("must not be exposed");
    expect(JSON.stringify(state)).not.toContain("synthetic-secret");
  });

  test("projects a bounded Host tree from the same snapshot request without Pane content", async () => {
    const config = gatewayConfig();
    const transports = new TransportRegistry(config.nodes);
    let calls = 0;
    const payload = {
      bridge: "connected",
      sessions: [session("default", { isPrimary: true })],
      agents: [agent("w0:p1", "working", { paneLabel: "build" })],
      shellPanes: [agent("w0:p2", "unknown", {
        agent: "shell",
        kind: "shell",
        paneLabel: "logs",
        cwd: "/private/shell-path",
        terminal: "must not be projected",
      })],
      workspaces: [{
        workspaceId: "w0",
        number: 1,
        label: "Example project",
        focused: true,
        activeTabId: "w0:t0",
        tabCount: 1,
        paneCount: 2,
      }],
      tabs: [{
        tabId: "w0:t0",
        workspaceId: "w0",
        number: 1,
        label: "Main",
        focused: true,
        paneCount: 2,
      }],
      ts: 50,
    };
    const fetcher = (async () => {
      calls += 1;
      return new Response(JSON.stringify(payload));
    }) as unknown as typeof fetch;
    const collector = new FleetCollector(config, transports, fetcher, () => 100);

    await collector.refresh();

    expect(calls).toBe(1);
    const trees = collector.snapshot().nodes[0]?.treeSessions;
    expect(trees).toEqual([{
      herdrSession: "default",
      primarySession: true,
      reachable: true,
      observedAt: 100,
      spaces: [{
        workspaceId: "w0",
        number: 1,
        label: "Example project",
        focused: true,
        tabs: [{
          tabId: "w0:t0",
          number: 1,
          label: "Main",
          focused: true,
          panes: [
            { paneId: "w0:p1", label: "build", agent: "codex", kind: "agent", status: "working", focused: false },
            { paneId: "w0:p2", label: "logs", agent: "shell", kind: "shell", status: "unknown", focused: false },
          ],
        }],
      }],
    }]);
    expect(JSON.stringify(trees)).not.toContain("private/shell-path");
    expect(JSON.stringify(trees)).not.toContain("must not be projected");
  });

  test("retains only failed sources as stale and removes recovered omissions", async () => {
    const config = gatewayConfig();
    const transports = new TransportRegistry(config.nodes);
    let round = 0;
    let clock = 100;
    const fetcher = (async (input: string | URL | Request) => {
      const named = new URL(String(input)).searchParams.get("session");
      if (!named) {
        if (round === 1) throw new Error("node offline");
        const primaryAgents = round === 2 ? [] : [agent("w0:p1", "blocked")];
        return response(primaryAgents, [
          session("default", { isPrimary: true, agents: primaryAgents.length, blocked: primaryAgents.length }),
          session("batch", { agents: round === 2 ? 0 : 1, working: round === 2 ? 0 : 1 }),
        ]);
      }
      if (round === 1) throw new Error("named session offline");
      return response(round === 2 ? [] : [agent("w1:p2", "working")]);
    }) as typeof fetch;
    const collector = new FleetCollector(config, transports, fetcher, () => clock);

    await collector.refresh();
    expect(collector.snapshot().nodes[0]?.agentEntries).toHaveLength(2);

    round = 1;
    clock = 5_100;
    await collector.refresh();
    const offline = collector.snapshot().nodes[0];
    expect(offline?.health).toBe("bridge-down");
    expect(offline?.agentEntries).toHaveLength(2);
    expect(offline?.agentEntries.every((entry) => !entry.reachable && entry.observedAt === 100)).toBeTrue();
    expect(offline?.treeSessions).toHaveLength(2);
    expect(offline?.treeSessions.every((entry) => !entry.reachable && entry.observedAt === 100)).toBeTrue();

    round = 2;
    clock = 10_100;
    await collector.refresh();
    const recovered = collector.snapshot().nodes[0];
    expect(recovered?.health).toBe("online");
    expect(recovered?.agentEntries).toEqual([]);
    expect(recovered?.treeSessions).toHaveLength(2);
    expect(recovered?.treeSessions.every((entry) => entry.reachable && entry.spaces.length === 0)).toBeTrue();
  });

  test("keeps a failed named session stale while its sibling remains current", async () => {
    const config = gatewayConfig();
    const transports = new TransportRegistry(config.nodes);
    let failNamed = false;
    let primaryStatus: "idle" | "working" = "idle";
    let clock = 100;
    const fetcher = (async (input: string | URL | Request) => {
      const named = new URL(String(input)).searchParams.get("session");
      if (named) {
        if (failNamed) throw new Error("named session unavailable");
        return response([agent("w1:p2", "blocked")]);
      }
      return response([agent("w0:p1", primaryStatus)], [
        session("default", { isPrimary: true }),
        session("batch", { blocked: 1 }),
      ]);
    }) as typeof fetch;
    const collector = new FleetCollector(config, transports, fetcher, () => clock);

    await collector.refresh();
    failNamed = true;
    primaryStatus = "working";
    clock = 5_100;
    await collector.refresh();

    const node = collector.snapshot().nodes[0];
    expect(node?.health).toBe("online");
    expect(node?.sessions.find((entry) => entry.name === "batch")?.reachable).toBeFalse();
    expect(node?.agentEntries.find((entry) => entry.herdrSession === "default")).toMatchObject({
      status: "working",
      reachable: true,
    });
    expect(node?.agentEntries.find((entry) => entry.herdrSession === "batch")).toMatchObject({
      status: "blocked",
      reachable: false,
    });
    expect(node?.treeSessions.find((entry) => entry.herdrSession === "default")?.reachable).toBeTrue();
    expect(node?.treeSessions.find((entry) => entry.herdrSession === "batch")?.reachable).toBeFalse();
  });

  test("changes revision only when visible state changes", async () => {
    const config = gatewayConfig();
    const transports = new TransportRegistry(config.nodes);
    let clock = 100;
    let status: "idle" | "working" = "idle";
    const fetcher = (async () => response([agent("w0:p1", status)])) as unknown as typeof fetch;
    const collector = new FleetCollector(config, transports, fetcher, () => clock);

    await collector.refresh();
    const first = collector.snapshot().revision;
    clock = 5_100;
    await collector.refresh();
    expect(collector.snapshot().revision).toBe(first);

    status = "working";
    clock = 15_100;
    await collector.refresh();
    expect(collector.snapshot().revision).toBe(first + 1);
    expect(collector.snapshot().refresh).toMatchObject({ delayMs: 5_000, nextAt: 20_100 });
  });

  test("owns one shared backoff and never revisits a cluster inside five seconds", async () => {
    const config = gatewayConfig();
    config.pollIntervalMs = 1_000;
    const transports = new TransportRegistry(config.nodes);
    let clock = 100;
    let calls = 0;
    const fetcher = (async () => {
      calls += 1;
      return response([], [session("default", { isPrimary: true, agents: 0 })]);
    }) as unknown as typeof fetch;
    const collector = new FleetCollector(config, transports, fetcher, () => clock);

    await collector.refresh();
    expect(calls).toBe(1);
    expect(collector.snapshot().refresh).toEqual({
      baseMs: 5_000,
      maxMs: 3_600_000,
      minNodeRevisitMs: 5_000,
      delayMs: 5_000,
      nextAt: 5_100,
    });

    clock = 200;
    await collector.refresh();
    await collector.refresh({ manual: true });
    expect(calls).toBe(1);
    expect(collector.snapshot().refresh).toMatchObject({ delayMs: 5_000, nextAt: 5_100 });

    clock = 5_099;
    await collector.refresh();
    expect(calls).toBe(1);

    clock = 5_100;
    await collector.refresh();
    expect(calls).toBe(2);
    expect(collector.snapshot().refresh).toMatchObject({ delayMs: 5_000, nextAt: 10_100 });

    clock = 10_100;
    await collector.refresh();
    expect(calls).toBe(3);
    expect(collector.snapshot().refresh).toMatchObject({ delayMs: 10_000, nextAt: 20_100 });

    clock = 15_100;
    await collector.refresh({ manual: true });
    expect(calls).toBe(4);
    expect(collector.snapshot().refresh).toMatchObject({ delayMs: 5_000, nextAt: 20_100 });
  });

  test("notification monitoring reschedules one timer from the shared backoff and manual floor", async () => {
    const config = gatewayConfig();
    const transports = new TransportRegistry(config.nodes);
    let clock = 100;
    let calls = 0;
    let nextHandle = 0;
    const jobs = new Map<number, { callback: () => void | Promise<void>; delayMs: number }>();
    const cancelled: number[] = [];
    const cycles: number[] = [];
    const collector = new FleetCollector(
      config,
      transports,
      (async () => {
        calls += 1;
        return response([], [session("default", { isPrimary: true, agents: 0 })]);
      }) as unknown as typeof fetch,
      () => clock,
      {
        schedule: (callback, delayMs) => {
          const handle = ++nextHandle;
          jobs.set(handle, { callback, delayMs });
          return handle;
        },
        cancel: (handle) => {
          cancelled.push(handle as number);
          jobs.delete(handle as number);
        },
        onCycle: (state) => {
          cycles.push(state.refresh.delayMs);
        },
      },
    );
    const fireOnlyTimer = async (): Promise<void> => {
      expect(jobs.size).toBe(1);
      const [handle, job] = [...jobs][0]!;
      jobs.delete(handle);
      await job.callback();
    };

    expect(jobs.size).toBe(0);
    collector.startBackgroundRefresh();
    collector.startBackgroundRefresh();
    expect([...jobs.values()].map((job) => job.delayMs)).toEqual([0]);
    await fireOnlyTimer();
    expect(calls).toBe(1);
    expect(cycles).toEqual([5_000]);
    expect([...jobs.values()].map((job) => job.delayMs)).toEqual([5_000]);

    clock = 200;
    await collector.refresh({ manual: true });
    expect(calls).toBe(1);
    expect([...jobs.values()].map((job) => job.delayMs)).toEqual([4_900]);

    clock = 5_100;
    await fireOnlyTimer();
    expect(calls).toBe(2);
    expect(cycles).toEqual([5_000, 5_000]);
    expect([...jobs.values()].map((job) => job.delayMs)).toEqual([5_000]);

    clock = 10_100;
    await fireOnlyTimer();
    expect(calls).toBe(3);
    expect(cycles).toEqual([5_000, 5_000, 10_000]);
    expect([...jobs.values()].map((job) => job.delayMs)).toEqual([10_000]);

    collector.stopBackgroundRefresh();
    expect(jobs.size).toBe(0);
    expect(cancelled.length).toBeGreaterThan(0);
  });

  test("coalesces repeated manual resets from a long backoff into one floor-bounded transaction and timer", async () => {
    const config = gatewayConfig();
    const transports = new TransportRegistry(config.nodes);
    let clock = 100;
    let calls = 0;
    let hold = false;
    let release: (() => void) | undefined;
    let gate = Promise.resolve();
    let nextHandle = 0;
    const jobs = new Map<number, { callback: () => void | Promise<void>; delayMs: number }>();
    const cycles: number[] = [];
    const collector = new FleetCollector(
      config,
      transports,
      (async () => {
        calls += 1;
        if (hold) await gate;
        return response([], [session("default", { isPrimary: true, agents: 0 })]);
      }) as unknown as typeof fetch,
      () => clock,
      {
        schedule: (callback, delayMs) => {
          const handle = ++nextHandle;
          jobs.set(handle, { callback, delayMs });
          return handle;
        },
        cancel: (handle) => jobs.delete(handle as number),
        onCycle: (state) => {
          cycles.push(state.refresh.delayMs);
        },
      },
    );

    collector.startBackgroundRefresh();
    for (const at of [100, 5_100, 15_100, 35_100]) {
      clock = at;
      await collector.refresh();
    }
    expect(calls).toBe(4);
    expect(collector.snapshot().refresh).toMatchObject({ delayMs: 40_000, nextAt: 75_100 });
    expect(jobs.size).toBe(1);

    clock = 35_101;
    await Promise.all([
      collector.refresh({ manual: true }),
      collector.refresh({ manual: true }),
      collector.refresh({ manual: true }),
    ]);
    expect(calls).toBe(4);
    expect(collector.snapshot().refresh).toMatchObject({ delayMs: 5_000, nextAt: 40_100 });
    expect([...jobs.values()].map((job) => job.delayMs)).toEqual([4_999]);

    hold = true;
    gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    clock = 40_100;
    const first = collector.refresh({ manual: true });
    const second = collector.refresh({ manual: true });
    const third = collector.refresh({ manual: true });
    expect(calls).toBe(5);
    release?.();
    await Promise.all([first, second, third]);
    expect(calls).toBe(5);
    expect(collector.snapshot().refresh).toMatchObject({ delayMs: 5_000, nextAt: 45_100 });
    expect(jobs.size).toBe(1);
    expect(cycles).toEqual([5_000, 10_000, 20_000, 40_000, 5_000]);
    collector.stopBackgroundRefresh();
  });

  test("clamps the one canonical timer to an observer deadline without changing backoff or the Host floor", async () => {
    const config = gatewayConfig();
    const transports = new TransportRegistry(config.nodes);
    let clock = 100;
    let calls = 0;
    let nextHandle = 0;
    let observerDeadline: number | null = null;
    const jobs = new Map<number, { callback: () => void | Promise<void>; delayMs: number }>();
    const collector = new FleetCollector(
      config,
      transports,
      (async () => {
        calls += 1;
        return response([], [session("default", { isPrimary: true, agents: 0 })]);
      }) as unknown as typeof fetch,
      () => clock,
      {
        schedule: (callback, delayMs) => {
          const handle = ++nextHandle;
          jobs.set(handle, { callback, delayMs });
          return handle;
        },
        cancel: (handle) => {
          jobs.delete(handle as number);
        },
        onCycle: () => observerDeadline,
      },
    );
    const fireOnlyTimer = async (): Promise<void> => {
      expect(jobs.size).toBe(1);
      const [handle, job] = [...jobs][0]!;
      jobs.delete(handle);
      await job.callback();
    };

    collector.startBackgroundRefresh();
    await fireOnlyTimer();
    expect(collector.snapshot().refresh).toMatchObject({ delayMs: 5_000, nextAt: 5_100 });

    observerDeadline = 9_000;
    clock = 5_100;
    await fireOnlyTimer();
    expect(calls).toBe(2);
    expect(collector.snapshot().refresh).toMatchObject({ delayMs: 10_000, nextAt: 10_100 });
    expect([...jobs.values()].map((job) => job.delayMs)).toEqual([5_000]);

    clock = 6_000;
    await collector.refresh({ manual: true });
    expect(calls).toBe(2);
    expect(jobs.size).toBe(1);
    expect([...jobs.values()].map((job) => job.delayMs)).toEqual([4_100]);

    observerDeadline = null;
    clock = 10_100;
    await fireOnlyTimer();
    expect(calls).toBe(3);
    expect(collector.snapshot().refresh).toMatchObject({ delayMs: 5_000, nextAt: 15_100 });
    expect(jobs.size).toBe(1);
    collector.stopBackgroundRefresh();
  });

  test("keeps collection page-driven until background monitoring is explicitly started", async () => {
    const config = gatewayConfig();
    const transports = new TransportRegistry(config.nodes);
    const jobs: unknown[] = [];
    const collector = new FleetCollector(config, transports, undefined, Date.now, {
      schedule: (callback, delayMs) => {
        jobs.push({ callback, delayMs });
        return jobs.length;
      },
      cancel: () => undefined,
    });

    expect(jobs).toEqual([]);
    expect(collector.snapshot().refresh.nextAt).toBe(0);
  });

  test("failed primary attempts activate the same hard revisit floor", async () => {
    const config = gatewayConfig();
    const transports = new TransportRegistry(config.nodes);
    let clock = 100;
    let calls = 0;
    const collector = new FleetCollector(
      config,
      transports,
      (async () => {
        calls += 1;
        throw new Error("synthetic bridge failure");
      }) as unknown as typeof fetch,
      () => clock,
    );

    await collector.refresh();
    expect(calls).toBe(1);
    expect(collector.snapshot().nodes[0]).toMatchObject({ health: "bridge-down", message: "synthetic bridge failure" });

    clock = 2_000;
    await collector.refresh({ manual: true });
    expect(calls).toBe(1);
    expect(collector.snapshot().refresh.nextAt).toBe(5_100);

    clock = 5_100;
    await collector.refresh();
    expect(calls).toBe(2);
    expect(collector.snapshot().refresh).toMatchObject({ delayMs: 5_000, nextAt: 10_100 });
  });

  test("coalesces concurrent refreshes", async () => {
    const config = gatewayConfig();
    const transports = new TransportRegistry(config.nodes);
    let calls = 0;
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetcher = (async () => {
      calls += 1;
      await gate;
      return response([]);
    }) as unknown as typeof fetch;
    const collector = new FleetCollector(config, transports, fetcher);

    const first = collector.refresh();
    const second = collector.refresh();
    expect(calls).toBe(1);
    release?.();
    await Promise.all([first, second]);
    expect(calls).toBe(1);
  });

  test("fails closed on malformed Agent routes and ambiguous session registries", async () => {
    const config = gatewayConfig();
    const transports = new TransportRegistry(config.nodes);
    const payloads = [
      {
        bridge: "connected",
        sessions: [session("default", { isPrimary: true })],
        agents: [agent("../../private")],
        ts: 50,
      },
      {
        bridge: "connected",
        sessions: [session("default", { isPrimary: true }), session("default")],
        agents: [],
        ts: 50,
      },
    ];

    for (const payload of payloads) {
      const collector = new FleetCollector(
        config,
        transports,
        (async () => new Response(JSON.stringify(payload))) as unknown as typeof fetch,
      );
      await collector.refresh();
      expect(collector.snapshot().nodes[0]).toMatchObject({ health: "bridge-down", agentEntries: [] });
    }
  });

  test("distinguishes transport, bridge, and Herdr failures", async () => {
    const config = gatewayConfig();
    const node = config.nodes[0]!;
    const downStatus: TransportStatus = { kind: "local", state: "down", pid: null, message: "link down" };
    const downTransport = {
      status: () => downStatus,
      upstream: () => "http://127.0.0.1:18788",
    } as unknown as TransportRegistry;
    const transportCollector = new FleetCollector(config, downTransport);
    await transportCollector.refresh();
    expect(transportCollector.snapshot().nodes[0]?.health).toBe("transport-down");

    const up = new TransportRegistry(config.nodes);
    const bridgeCollector = new FleetCollector(
      config,
      up,
      (async () => {
        throw new Error("connection refused");
      }) as unknown as typeof fetch,
    );
    await bridgeCollector.refresh();
    expect(bridgeCollector.snapshot().nodes[0]?.health).toBe("bridge-down");

    const herdrCollector = new FleetCollector(
      config,
      up,
      (async () => response([], [session(node.id, { isPrimary: true, reachable: false, agents: 0 })], "disconnected")) as unknown as typeof fetch,
    );
    await herdrCollector.refresh();
    expect(herdrCollector.snapshot().nodes[0]?.health).toBe("herdr-down");
  });
});
