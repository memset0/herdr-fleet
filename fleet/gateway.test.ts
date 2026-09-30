import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import type { FleetLeadConfig } from "./config.ts";
import { createGatewayHandler, trustedClientSource } from "./gateway.ts";
import type { FleetFetcher } from "./proxy.ts";
import { LoginRateLimiter } from "./rate-limit.ts";
import { SessionStore } from "./session-store.ts";
import { fleetTestConfig } from "./test-helpers.ts";
import type { FleetReleaseObserver } from "./version/release-observer.ts";

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

async function setup(fetcher: FleetFetcher = fetch, versions?: FleetReleaseObserver) {
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
      versions,
      now: () => 1_000,
      loginCsrfToken,
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
    for (const path of ["/assets/app.js.map", "/assets/../secret", "/pane/p1?session=demo"]) {
      const response = await handler(request(path), { peerAddress: "127.0.0.1" });
      expect(response.status).toBe(303);
      expect(response.headers.get("location")).toStartWith("/auth/login?next=");
    }
    expect(calls).toBe(2);
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

  test("serves cached publication evidence only through the authenticated read route", async () => {
    let observations = 0;
    const versions: FleetReleaseObserver = {
      observe: () => {
        observations += 1;
        return {
          latest: "3.3.0",
          majors: [{ major: 3, version: "3.3.0" }],
          checkedAt: 900,
          freshUntil: 1_200,
          freshness: "fresh",
        };
      },
    };
    const { handler } = await setup(fetch, versions);
    expect(
      (await handler(request("/fleet/api/version"), { peerAddress: "127.0.0.1" })).status,
    ).toBe(401);
    expect(observations).toBe(0);

    const cookie = await login(handler);
    const response = await handler(
      request("/fleet/api/version", { headers: { cookie } }),
      { peerAddress: "127.0.0.1" },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      latest: "3.3.0",
      majors: [{ major: 3, version: "3.3.0" }],
      checkedAt: 900,
      freshUntil: 1_200,
      freshness: "fresh",
    });
    const write = await handler(
      request("/fleet/api/version", {
        method: "POST",
        headers: { cookie, origin: config.public.origin },
      }),
      { peerAddress: "127.0.0.1" },
    );
    expect(write.status).toBe(405);
    expect(observations).toBe(1);
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
