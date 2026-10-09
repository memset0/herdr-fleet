import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import type { FleetLeadConfig } from "./config.ts";
import { PAIRING_REFUSAL, createGatewayHandler, trustedClientSource, type GatewayOptions } from "./gateway.ts";
import { createTagStore } from "./pane-tags/store.ts";
import type { FleetFetcher } from "./proxy.ts";
import { LoginRateLimiter } from "./rate-limit.ts";
import { SessionStore } from "./session-store.ts";
import { fleetTestConfig } from "./test-helpers.ts";

let config: FleetLeadConfig;
const loginCsrfToken = "C".repeat(43);
const roots: string[] = [];

afterAll(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

beforeAll(async () => {
  const base = fleetTestConfig();
  config = {
    ...base,
    auth: {
      ...base.auth,
      passwordHash: await Bun.password.hash("gateway-test-password", {
        algorithm: "argon2id",
        memoryCost: 4_096,
        timeCost: 1,
      }),
    },
  };
});

function request(path: string, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  headers.set("host", config.public.host);
  return new Request(`${config.public.origin}${path}`, { ...init, headers });
}

async function setup(fetcher: FleetFetcher = fetch, extra: Partial<GatewayOptions> = {}) {
  const root = await mkdtemp(join(tmpdir(), "herdr-fleet-gateway-"));
  roots.push(root);
  const sessions = new SessionStore(join(root, "sessions.json"));
  const limiter = new LoginRateLimiter(config.auth.rateLimit);
  return {
    sessions,
    handler: createGatewayHandler({
      config,
      sessions,
      limiter,
      fetcher,
      now: () => 1_000,
      loginCsrfToken,
      ...extra,
    }),
  };
}

async function login(handler: Awaited<ReturnType<typeof setup>>["handler"]): Promise<string> {
  const response = await handler(
    request("/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        origin: config.public.origin,
        "x-forwarded-for": "192.0.2.8",
      },
      body: new URLSearchParams({
        username: "operator",
        password: "gateway-test-password",
        next: "/pane/p1?session=demo",
      }),
    }),
    { peerAddress: "127.0.0.1" },
  );
  expect(response.status).toBe(303);
  expect(response.headers.get("location")).toBe("/pane/p1?session=demo");
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
  if (cookie === undefined) throw new Error("login did not issue a cookie");
  return cookie;
}

describe("authenticated solo Gateway", () => {
  test("rejects every unauthenticated API and Pack path before upstream", async () => {
    let calls = 0;
    const { handler } = await setup((async () => {
      calls += 1;
      return new Response("unexpected");
    }));
    for (const path of ["/api/snapshot", "/api/config", "/api/pane/p1", "/api/unknown"]) {
      const response = await handler(request(path), { peerAddress: "127.0.0.1" });
      expect(response.status).toBe(401);
    }
    for (const path of ["/crew/v1/enroll", "/pack/v1/enroll"]) {
      expect((await handler(request(path), { peerAddress: "127.0.0.1" })).status).toBe(404);
    }
    expect(calls).toBe(0);
  });

  test("keeps the crew link denied after login and never contacts Collie for it", async () => {
    let calls = 0;
    const { handler } = await setup(async () => {
      calls += 1;
      return new Response("<!doctype html>", { headers: { "content-type": "text/html" } });
    });
    const cookie = await login(handler);
    for (const path of ["/crew/v1/hello", "/crew/v1/snapshot", "/crew/v1/pane/p1/reply", "/crew/v1/enroll"]) {
      for (const method of ["GET", "POST"]) {
        const response = await handler(
          request(path, { method, headers: { cookie } }),
          { peerAddress: "127.0.0.1" },
        );
        expect(response.status).toBe(404);
      }
    }
    expect(calls).toBe(0);
    // The browser-facing crew page and its previous-name redirect are application routes.
    for (const path of ["/crew", "/pack"]) {
      const page = await handler(request(path, { headers: { cookie } }), { peerAddress: "127.0.0.1" });
      expect(page.status).toBe(200);
    }
    expect(calls).toBe(2);
  });

  test("keeps Pack paths denied after login while normal native APIs remain proxied", async () => {
    let calls = 0;
    const { handler } = await setup(async () => {
      calls += 1;
      return new Response('{"ok":true}', { headers: { "content-type": "application/json" } });
    });
    const cookie = await login(handler);
    for (const path of ["/pack/v1/hello", "/pack/v1/snapshot", "/pack/v1/pane/p1/reply"]) {
      const response = await handler(
        request(path, { headers: { cookie } }),
        { peerAddress: "127.0.0.1" },
      );
      expect(response.status).toBe(404);
    }
    expect(calls).toBe(0);
    const native = await handler(
      request("/api/snapshot", { headers: { cookie } }),
      { peerAddress: "127.0.0.1" },
    );
    expect(native.status).toBe(200);
    expect(calls).toBe(1);
  });

  test("keeps only exact update assets public and sends documents to login", async () => {
    let calls = 0;
    const { handler } = await setup((async () => {
      calls += 1;
      return new Response("asset", { headers: { "cache-control": "public, max-age=60" } });
    }));
    expect((await handler(request("/sw.js"), { peerAddress: "127.0.0.1" })).status).toBe(200);
    expect((await handler(request("/assets/app-ABC123.js"), { peerAddress: "127.0.0.1" })).status).toBe(200);
    expect(calls).toBe(2);
    for (const path of ["/collie-mark-header-light.svg", "/collie-mark-header-dark.svg"]) {
      const response = await handler(request(path), { peerAddress: "127.0.0.1" });
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("public, max-age=60");
    }
    expect(calls).toBe(4);
    for (const path of [
      "/assets/app.js.map",
      "/assets/../secret",
      "/pane/p1?session=demo",
      "/collie-mark-header.svg",
      "/collie-mark-header-light.svg.map",
      "/dog-gallop.png",
    ]) {
      const response = await handler(request(path), { peerAddress: "127.0.0.1" });
      expect(response.status).toBe(303);
      expect(response.headers.get("location")).toStartWith("/auth/login?next=");
    }
    expect(calls).toBe(4);
  });

  test("logs in, proxies without its cookie, and revokes the copied token on logout", async () => {
    let upstreamCookie: string | null = null;
    const { handler } = await setup((async (_input, init) => {
      upstreamCookie = new Headers(init?.headers).get("cookie");
      return new Response('{"bridge":"connected"}', { headers: { "content-type": "application/json" } });
    }));
    const cookie = await login(handler);
    const authenticated = await handler(
      request("/api/snapshot", { headers: { cookie } }),
      { peerAddress: "127.0.0.1" },
    );
    expect(authenticated.status).toBe(200);
    expect(upstreamCookie).toBeNull();
    expect(authenticated.headers.get("cache-control")).toBe("no-store");

    const logout = await handler(
      request("/auth/logout", { method: "POST", headers: { cookie, origin: config.public.origin } }),
      { peerAddress: "127.0.0.1" },
    );
    expect(logout.status).toBe(303);
    expect(logout.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(
      (await handler(request("/api/snapshot", { headers: { cookie } }), { peerAddress: "127.0.0.1" })).status,
    ).toBe(401);
  });

  test("requires exact same-origin evidence for login and authenticated writes", async () => {
    const { handler } = await setup(async () => new Response("ok"));
    const crossOriginLogin = await handler(
      request("/auth/login", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", origin: "https://evil.example" },
        body: new URLSearchParams({ username: "operator", password: "gateway-test-password" }),
      }),
      { peerAddress: "127.0.0.1" },
    );
    expect(crossOriginLogin.status).toBe(403);
    const refererLogin = await handler(
      request("/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          referer: `${config.public.origin}/auth/login`,
        },
        body: new URLSearchParams({ username: "operator", password: "gateway-test-password" }),
      }),
      { peerAddress: "127.0.0.1" },
    );
    expect(refererLogin.status).toBe(303);
    const tokenLogin = await handler(
      request("/auth/login", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          username: "operator",
          password: "gateway-test-password",
          csrf_token: loginCsrfToken,
        }),
      }),
      { peerAddress: "127.0.0.1" },
    );
    expect(tokenLogin.status).toBe(303);
    const missingEvidence = await handler(
      request("/auth/login", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ username: "operator", password: "gateway-test-password" }),
      }),
      { peerAddress: "127.0.0.1" },
    );
    expect(missingEvidence.status).toBe(403);
    const cookie = await login(handler);
    const write = await handler(
      request("/api/pane/p1/reply", { method: "POST", headers: { cookie, origin: "https://evil.example" }, body: "x" }),
      { peerAddress: "127.0.0.1" },
    );
    expect(write.status).toBe(403);
  });

  test("uses a trusted single client address only from a loopback proxy peer", () => {
    const supplied = request("/auth/login", { headers: { "x-forwarded-for": "192.0.2.9" } });
    expect(trustedClientSource(supplied, { peerAddress: "127.0.0.1" }, config)).toBe("192.0.2.9");
    const appended = request("/auth/login", { headers: { "x-forwarded-for": "attacker, 192.0.2.9" } });
    expect(trustedClientSource(appended, { peerAddress: "127.0.0.1" }, config)).toBe("loopback");
    expect(trustedClientSource(supplied, { peerAddress: "198.51.100.2" }, config)).toBe("198.51.100.2");
  });

  test("fails unknown Host and emits strict login security headers", async () => {
    const { handler } = await setup();
    const unknown = request("/");
    unknown.headers.set("host", "unknown.example");
    expect((await handler(unknown, { peerAddress: "127.0.0.1" })).status).toBe(404);
    const loginPage = await handler(request("/auth/login"), { peerAddress: "127.0.0.1" });
    expect(loginPage.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(loginPage.headers.get("referrer-policy")).toBe("same-origin");
    expect(loginPage.headers.get("permissions-policy")).toBe("camera=(), microphone=(self), geolocation=()");
    expect(await loginPage.text()).toContain(`name="csrf_token" value="${loginCsrfToken}"`);
    expect(loginPage.headers.get("x-frame-options")).toBe("DENY");
    expect(loginPage.headers.get("cache-control")).toBe("no-store");
  });

  test("owns no published-release route: the retired version path is Collie's like any other", async () => {
    const proxied: string[] = [];
    const { handler } = await setup(async (input) => {
      proxied.push(new URL(input instanceof Request ? input.url : String(input)).pathname);
      return new Response("collie", { status: 404 });
    });
    // No longer a Fleet machine surface, so an anonymous caller meets the login redirect, not a 401.
    const anonymous = await handler(request("/fleet/api/version"), { peerAddress: "127.0.0.1" });
    expect([302, 303]).toContain(anonymous.status);
    expect(proxied).toEqual([]);

    const cookie = await login(handler);
    const response = await handler(request("/fleet/api/version", { headers: { cookie } }), {
      peerAddress: "127.0.0.1",
    });
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("collie");
    expect(proxied).toEqual(["/fleet/api/version"]);
  });

  test("contains an authenticated upstream failure without exposing its exception", async () => {
    const { handler } = await setup(async () => {
      throw new Error("private upstream detail");
    });
    const cookie = await login(handler);
    const response = await handler(request("/api/snapshot", { headers: { cookie } }), { peerAddress: "127.0.0.1" });
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "upstream unavailable" });
  });
});

describe("manual Pane fit on the Gateway", () => {
  function paneFit(log: string[] = []) {
    const calls: Array<[string, number]> = [];
    return {
      calls,
      deps: {
        local: {
          resize: async (paneId: string, cols: number) => {
            calls.push([paneId, cols]);
            return { ok: true as const, cols, rows: 31 };
          },
          held: () => 0,
          dispose: () => undefined,
        },
        members: () => [],
        log: (event: string) => void log.push(event),
      },
    };
  }

  test("an unauthenticated resize is a 401, not a login page, and resizes nothing", async () => {
    const fit = paneFit();
    const { handler } = await setup(fetch, { paneFit: fit.deps });
    const response = await handler(
      request("/fleet/api/pane/w1%3Ap1/resize", {
        method: "POST",
        headers: { origin: config.public.origin, "content-type": "application/json" },
        body: JSON.stringify({ cols: 80 }),
      }),
      { peerAddress: "127.0.0.1" },
    );
    expect(response.status).toBe(401);
    expect(fit.calls).toEqual([]);
  });

  test("a cross-origin resize is refused before any Pane is resolved", async () => {
    const fit = paneFit();
    const { handler } = await setup(fetch, { paneFit: fit.deps });
    const cookie = await login(handler);
    for (const origin of ["https://attacker.example", null]) {
      const headers = new Headers({ cookie, "content-type": "application/json" });
      if (origin !== null) headers.set("origin", origin);
      const response = await handler(
        request("/fleet/api/pane/w1%3Ap1/resize", { method: "POST", headers, body: JSON.stringify({ cols: 80 }) }),
        { peerAddress: "127.0.0.1" },
      );
      expect(response.status).toBe(403);
    }
    expect(fit.calls).toEqual([]);
  });

  test("an authenticated same-origin resize is served by Fleet and never reaches Collie", async () => {
    const fit = paneFit();
    const log: string[] = [];
    let proxied = 0;
    const { handler } = await setup(
      async () => {
        proxied += 1;
        return new Response("collie");
      },
      { paneFit: { ...fit.deps, log: (event) => void log.push(event) } },
    );
    const cookie = await login(handler);
    const response = await handler(
      request("/fleet/api/pane/w1%3Ap1/resize", {
        method: "POST",
        headers: { cookie, origin: config.public.origin, "content-type": "application/json" },
        body: JSON.stringify({ cols: 80 }),
      }),
      { peerAddress: "127.0.0.1" },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, cols: 80, rows: 31 });
    expect(fit.calls).toEqual([["w1:p1", 80]]);
    expect(log).toEqual(["pane-fit.resize"]);
    expect(proxied).toBe(0);
  });

  test("without a configured fit both routes are 404", async () => {
    const { handler } = await setup();
    const cookie = await login(handler);
    const response = await handler(request("/fleet/api/pane-fit", { headers: { cookie } }), {
      peerAddress: "127.0.0.1",
    });
    expect(response.status).toBe(404);
  });
});

describe("the Gateway as Collie's paired device", () => {
  test("refuses every pairing write before Collie, with a body that triggers no wipe", async () => {
    const seen: string[] = [];
    const { handler } = await setup(async (input) => {
      seen.push(new URL(String(input)).pathname);
      return new Response("{}", { headers: { "content-type": "application/json" } });
    });
    const cookie = await login(handler);
    const write = (path: string, method = "POST") =>
      handler(
        request(path, { method, headers: { cookie, origin: config.public.origin, "content-type": "application/json" }, body: "{}" }),
        { peerAddress: "127.0.0.1" },
      );
    for (const [path, method] of [["/api/pair", "POST"], ["/api/devices/revoke", "POST"], ["/api/devices", "DELETE"]] as const) {
      const response = await write(path, method);
      expect(response.status).toBe(403);
      const body = (await response.text()).trim();
      expect(body).toBe(PAIRING_REFUSAL);
      expect(["device not paired", "device expired"]).not.toContain(body);
    }
    expect(seen).toEqual([]);
    // Reading the device list is a read, and Collie answers it.
    const list = await handler(request("/api/devices", { headers: { cookie } }), { peerAddress: "127.0.0.1" });
    expect(list.status).toBe(200);
    expect(seen).toEqual(["/api/devices"]);
  });

  test("sends its own pairing token on proxied requests and on its own inventory read", async () => {
    const authorizations: (string | null)[] = [];
    const root = await mkdtemp(join(tmpdir(), "herdr-fleet-gateway-tags-"));
    roots.push(root);
    const { handler } = await setup(
      async (input, init) => {
        authorizations.push(new Headers(init?.headers).get("authorization"));
        const path = new URL(String(input)).pathname;
        return path === "/api/snapshot"
          ? new Response(JSON.stringify({ servers: [], agents: [], shellPanes: [] }), { headers: { "content-type": "application/json" } })
          : new Response("{}", { headers: { "content-type": "application/json" } });
      },
      { collieToken: "gateway-token", tags: createTagStore(join(root, "pane-tags.json")) },
    );
    const cookie = await login(handler);
    await handler(request("/api/config", { headers: { cookie, authorization: "Bearer browser" } }), { peerAddress: "127.0.0.1" });
    await handler(request("/fleet/api/pane-tags", { headers: { cookie } }), { peerAddress: "127.0.0.1" });
    expect(authorizations.length).toBeGreaterThanOrEqual(2);
    expect(new Set(authorizations)).toEqual(new Set(["Bearer gateway-token"]));
  });
});

