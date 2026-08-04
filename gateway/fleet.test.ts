import { describe, expect, test } from "bun:test";

import { FleetCollector } from "./fleet.ts";
import { TransportRegistry, type TransportStatus } from "./transports.ts";
import { gatewayConfig } from "./test-helpers.ts";

describe("Fleet aggregation", () => {
  test("aggregates stable session summaries and native node totals", async () => {
    const config = gatewayConfig();
    const transports = new TransportRegistry(config.nodes);
    const fetcher = (async () =>
      new Response(
        JSON.stringify({
          bridge: "connected",
          sessions: [
            { name: "default", isPrimary: true, reachable: true, agents: 3, working: 2, blocked: 1 },
            { name: "batch demo", isPrimary: false, reachable: true, agents: 1, working: 0, blocked: 0 },
          ],
          ts: 50,
          agents: [{ terminal: "must not be consumed" }],
        }),
        { headers: { "content-type": "application/json" } },
      )) as unknown as typeof fetch;
    const collector = new FleetCollector(config, transports, fetcher, () => 100);
    await collector.refresh();
    const state = collector.snapshot();
    expect(state.totals).toEqual({ nodes: 1, online: 1, agents: 4, working: 2, blocked: 1 });
    expect(state.nodes[0]?.sessions.map((session) => session.name)).toEqual(["default", "batch demo"]);
    expect(state.nodes[0]?.health).toBe("online");
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
      (async () =>
        new Response(
          JSON.stringify({
            bridge: "disconnected",
            sessions: [{ name: node.id, isPrimary: true, reachable: false, agents: 0, working: 0, blocked: 0 }],
            ts: 1,
          }),
        )) as unknown as typeof fetch,
    );
    await herdrCollector.refresh();
    expect(herdrCollector.snapshot().nodes[0]?.health).toBe("herdr-down");
  });
});
