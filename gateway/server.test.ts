import { beforeAll, describe, expect, test } from "bun:test";

import { LoginRateLimiter } from "./auth.ts";
import { FleetCollector } from "./fleet.ts";
import { createGatewayHandler } from "./server.ts";
import { gatewayConfig } from "./test-helpers.ts";
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

function setup(fetcher: typeof fetch = fetch, limiter?: LoginRateLimiter, now?: () => number) {
  const transports = new TransportRegistry(config.nodes);
  const collector = new FleetCollector(config, transports, (async () => {
    throw new Error("not polled in handler tests");
  }) as unknown as typeof fetch);
  return createGatewayHandler({ config, collector, transports, fetcher, limiter, now });
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
