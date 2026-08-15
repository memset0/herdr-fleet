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
  return new Response(JSON.stringify({ bridge, sessions, agents, ts: 50 }), {
    headers: { "content-type": "application/json" },
  });
}

describe("Fleet aggregation", () => {
  test("projects safe Agent cards across primary and named sessions", async () => {
    const config = gatewayConfig();
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
    expect(state.refresh).toEqual({ baseMs: 5_000, maxMs: 3_600_000 });
    expect(state.nodes[0]?.sessions.map((entry) => entry.name)).toEqual(["default", "batch demo"]);
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
    clock = 200;
    await collector.refresh();
    const offline = collector.snapshot().nodes[0];
    expect(offline?.health).toBe("bridge-down");
    expect(offline?.agentEntries).toHaveLength(2);
    expect(offline?.agentEntries.every((entry) => !entry.reachable && entry.observedAt === 100)).toBeTrue();

    round = 2;
    clock = 300;
    await collector.refresh();
    const recovered = collector.snapshot().nodes[0];
    expect(recovered?.health).toBe("online");
    expect(recovered?.agentEntries).toEqual([]);
  });

  test("keeps a failed named session stale while its sibling remains current", async () => {
    const config = gatewayConfig();
    const transports = new TransportRegistry(config.nodes);
    let failNamed = false;
    let primaryStatus: "idle" | "working" = "idle";
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
    const collector = new FleetCollector(config, transports, fetcher, () => 100);

    await collector.refresh();
    failNamed = true;
    primaryStatus = "working";
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
    clock = 200;
    await collector.refresh();
    expect(collector.snapshot().revision).toBe(first);

    status = "working";
    await collector.refresh();
    expect(collector.snapshot().revision).toBe(first + 1);
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
