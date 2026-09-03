import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import type { FleetConfig } from "./config.ts";
import { startGateway } from "./server.ts";
import { SessionStore } from "./session-store.ts";
import { fleetTestConfig } from "./test-helpers.ts";

describe("Fleet Gateway listener", () => {
  test("binds loopback and applies the handler before the Collie fetcher", async () => {
    const state = await mkdtemp(join(tmpdir(), "herdr-fleet-listener-"));
    const base = fleetTestConfig();
    const config: FleetConfig = { ...base, listen: { ...base.listen, port: 0 } };
    let upstreamCalls = 0;
    const server = startGateway({
      config,
      sessions: new SessionStore(join(state, "sessions.json")),
      fetcher: async () => {
        upstreamCalls += 1;
        return new Response("unexpected");
      },
    });
    try {
      const response = await fetch(`http://127.0.0.1:${server.port}/api/snapshot`, {
        headers: { host: config.public.host },
      });
      expect(response.status).toBe(401);
      expect(upstreamCalls).toBe(0);
      expect(server.hostname).toBe("127.0.0.1");
    } finally {
      await server.stop(true);
    }
  });
});
