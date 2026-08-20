import { beforeAll, describe, expect, test } from "bun:test";

import { LoginRateLimiter } from "./auth.ts";
import { parseGatewayConfig, type GatewayConfig } from "./config.ts";
import { FleetCollector } from "./fleet.ts";
import { createGatewayHandler } from "./server.ts";
import { gatewayConfig, rawGatewayConfig } from "./test-helpers.ts";
import { TransportRegistry } from "./transports.ts";

const config = gatewayConfig();
beforeAll(async () => {
  config.auth.passwordHash = await Bun.password.hash("gateway-test-password", {
    algorithm: "argon2id",
    memoryCost: 4_096,
    timeCost: 1,
  });
});

function request(host: string, path: string, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  headers.set("host", host);
  return new Request(`https://${host}${path}`, { ...init, headers });
}

function setup(
  fetcher: typeof fetch = fetch,
  limiter?: LoginRateLimiter,
  now?: () => number,
  gateway: GatewayConfig = config,
  collectorFetcher: typeof fetch = (async () => {
    throw new Error("not polled in handler tests");
  }) as unknown as typeof fetch,
  pluginVersion = "2.4.1-test",
) {
  const transports = new TransportRegistry(gateway.nodes);
  const collector = new FleetCollector(gateway, transports, collectorFetcher, now ?? Date.now);
  return createGatewayHandler({ config: gateway, collector, transports, fetcher, limiter, now, pluginVersion });
}

async function login(handler: ReturnType<typeof setup>, next = "https://fleet.example.com/"): Promise<string> {
  const response = await handler(
    request("fleet.example.com", "/auth/login", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", "x-forwarded-for": "192.0.2.8" },
      body: new URLSearchParams({ username: "operator", password: "gateway-test-password", next }),
    }),
  );
  expect(response.status).toBe(303);
  expect(response.headers.get("location")).toBe(next);
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
  if (!cookie) throw new Error("login did not issue a cookie");
  return cookie;
}

describe("Gateway host routing and auth flow", () => {
  test("fails unknown hosts closed without proxying", async () => {
    let calls = 0;
    const handler = setup((async () => {
      calls += 1;
      return new Response("unexpected");
    }) as unknown as typeof fetch);
    const response = await handler(request("unknown.example.com", "/"));
    expect(response.status).toBe(404);
    expect(calls).toBe(0);
  });

  test("denies APIs and preserves a deep-link return URL for navigations", async () => {
    const handler = setup();
    expect((await handler(request("local.example.com", "/api/snapshot"))).status).toBe(401);
    const deep = await handler(request("local.example.com", "/pane/p1?session=batch%20demo"));
    expect(deep.status).toBe(303);
    const location = new URL(deep.headers.get("location")!);
    expect(location.origin + location.pathname).toBe("https://fleet.example.com/auth/login");
    expect(location.searchParams.get("next")).toBe("https://local.example.com/pane/p1?session=batch%20demo");
  });

  test("refreshes node state only for an authenticated Fleet API read", async () => {
    let clock = 100;
    let calls = 0;
    const collectorFetcher = (async () => {
      calls += 1;
      return new Response(
        JSON.stringify({
          bridge: "connected",
          sessions: [
            { name: "default", isPrimary: true, reachable: true, agents: 0, working: 0, blocked: 0 },
          ],
          agents: [],
          shellPanes: [],
          workspaces: [],
          tabs: [],
          ts: 10,
        }),
        { headers: { "content-type": "application/json" } },
      );
    }) as unknown as typeof fetch;
    const handler = setup(fetch, undefined, () => clock, config, collectorFetcher);

    expect((await handler(request("fleet.example.com", "/api/fleet"))).status).toBe(401);
    expect(calls).toBe(0);

    const cookie = await login(handler);
    const response = await handler(request("fleet.example.com", "/api/fleet", { headers: { cookie } }));
    expect(response.status).toBe(200);
    expect(calls).toBe(1);
    expect(await response.json()).toMatchObject({
      generatedAt: 100,
      refresh: {
        baseMs: 5_000,
        maxMs: 3_600_000,
        minNodeRevisitMs: 5_000,
        delayMs: 5_000,
        nextAt: 5_100,
      },
      totals: { nodes: 1, online: 1, agents: 0 },
    });

    clock = 200;
    const cached = await handler(request("fleet.example.com", "/api/fleet?manual=1", { headers: { cookie } }));
    expect(cached.status).toBe(200);
    expect(calls).toBe(1);
    expect(await cached.json()).toMatchObject({ refresh: { delayMs: 5_000, nextAt: 5_100 } });

    clock = 5_100;
    const due = await handler(request("fleet.example.com", "/api/fleet", { headers: { cookie } }));
    expect(due.status).toBe(200);
    expect(calls).toBe(2);
    expect(await due.json()).toMatchObject({ refresh: { delayMs: 5_000, nextAt: 10_100 } });
  });

  test("logs in once and proxies node requests without the session credential", async () => {
    const seen: { cookie: string | null; host: string | null } = { cookie: null, host: null };
    const handler = setup((async (_input: string | URL | Request, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      seen.cookie = headers.get("cookie");
      seen.host = headers.get("host");
      return new Response(JSON.stringify({ bridge: "connected" }), {
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch);
    const cookie = await login(handler, "https://local.example.com/pane/p1?session=demo");
    const response = await handler(
      request("local.example.com", "/api/snapshot?session=demo", {
        headers: { cookie: `${cookie}; collie_pref=kept`, origin: "https://local.example.com" },
      }),
    );
    expect(response.status).toBe(200);
    expect(seen.host).toBe("local.example.com");
    expect(seen.cookie).toBe("collie_pref=kept");
  });

  test("allows only Fleet to frame configured node documents", async () => {
    const raw = rawGatewayConfig();
    raw.nodes = [
      ...(raw.nodes as object[]),
      {
        id: "remote",
        name: "Remote node",
        publicHost: "remote.example.com",
        enabled: true,
        labels: [],
        transport: { type: "local", url: "http://127.0.0.1:18789" },
      },
      {
        id: "disabled",
        name: "Disabled node",
        publicHost: "disabled.example.com",
        enabled: false,
        labels: [],
        transport: { type: "local", url: "http://127.0.0.1:18790" },
      },
    ];
    raw.fleetUi = { iframeCacheSize: 5 };
    const framedConfig = parseGatewayConfig(raw);
    framedConfig.auth.passwordHash = config.auth.passwordHash;
    const handler = setup((async (input: string | URL | Request) => {
      const pathname = new URL(String(input)).pathname;
      if (pathname.startsWith("/api/")) {
        return new Response("{}", {
          headers: { "content-type": "application/json", "x-frame-options": "SAMEORIGIN" },
        });
      }
      return new Response("<!doctype html><title>Collie</title>", {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "content-security-policy":
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'",
          "x-frame-options": "SAMEORIGIN",
        },
      });
    }) as typeof fetch, undefined, undefined, framedConfig);
    const cookie = await login(handler);

    const fleet = await handler(request("fleet.example.com", "/", { headers: { cookie } }));
    const fleetCsp = fleet.headers.get("content-security-policy") ?? "";
    expect(fleet.status).toBe(200);
    expect(fleet.headers.get("x-frame-options")).toBe("DENY");
    expect(fleet.headers.get("referrer-policy")).toBe("same-origin");
    expect(fleetCsp).toContain("frame-ancestors 'none'");
    expect(fleetCsp).toContain("frame-src https://local.example.com https://remote.example.com");
    expect(fleetCsp).not.toContain("disabled.example.com");
    expect(fleetCsp).not.toContain("*.example.com");
    expect(await fleet.text()).toContain('data-iframe-cache-size="5"');
    expect(await (await handler(request("fleet.example.com", "/", { headers: { cookie } }))).text()).toContain('data-plugin-version="2.4.1-test"');

    const node = await handler(request("local.example.com", "/", { headers: { cookie } }));
    const nodeCsp = node.headers.get("content-security-policy") ?? "";
    expect(node.status).toBe(200);
    expect(node.headers.get("x-frame-options")).toBeNull();
    expect(node.headers.get("x-content-type-options")).toBe("nosniff");
    expect(node.headers.get("referrer-policy")).toBe("no-referrer");
    expect(nodeCsp).toContain("default-src 'self'");
    expect(nodeCsp).toContain("script-src 'self'");
    expect(nodeCsp).toContain("frame-ancestors https://fleet.example.com");
    expect(nodeCsp).not.toContain("frame-ancestors 'none'");

    const api = await handler(request("local.example.com", "/api/snapshot", { headers: { cookie } }));
    expect(api.headers.get("x-frame-options")).toBe("DENY");
  });

  test("keeps only static PWA update assets public and reserves /auth", async () => {
    let calls = 0;
    const handler = setup((async () => {
      calls += 1;
      return new Response("asset");
    }) as unknown as typeof fetch);
    expect((await handler(request("local.example.com", "/sw.js"))).status).toBe(200);
    expect(calls).toBe(1);
    expect((await handler(request("local.example.com", "/auth/not-collie"))).status).toBe(404);
    expect(calls).toBe(1);
  });

  test("returns a controlled 502 when one node upstream fails", async () => {
    const handler = setup((async () => {
      throw new Error("synthetic connection failure");
    }) as unknown as typeof fetch);
    const cookie = await login(handler);
    const response = await handler(request("local.example.com", "/api/snapshot", { headers: { cookie } }));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "node upstream unavailable" });
  });

  test("requires same-origin POST for logout and rate-limits invalid passwords", async () => {
    let clock = 1_000;
    const limiter = new LoginRateLimiter(2, 10_000, 20_000);
    const handler = setup(fetch, limiter, () => clock);
    expect((await handler(request("fleet.example.com", "/auth/logout", { method: "POST" }))).status).toBe(403);

    const invalid = () =>
      handler(
        request("fleet.example.com", "/auth/login", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded", "x-forwarded-for": "198.51.100.4" },
          body: new URLSearchParams({ username: "operator", password: "wrong" }),
        }),
      );
    expect((await invalid()).status).toBe(401);
    clock += 1;
    expect((await invalid()).status).toBe(401);
    clock += 1;
    expect((await invalid()).status).toBe(429);

    const cookie = await login(setup());
    const logout = await setup()(request("local.example.com", "/auth/logout", {
      method: "POST",
      headers: { cookie, origin: "https://local.example.com" },
    }));
    expect(logout.status).toBe(303);
    expect(logout.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});
