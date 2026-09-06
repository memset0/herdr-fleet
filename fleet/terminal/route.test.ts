import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import type { FleetLeadConfig } from "../config.ts";
import { createGatewayHandler, type TerminalUpgrade } from "../gateway.ts";
import { LoginRateLimiter } from "../rate-limit.ts";
import { SessionStore } from "../session-store.ts";
import { fleetTestConfig } from "../test-helpers.ts";
import { TERMINAL_PATH } from "./admit.ts";

let config: FleetLeadConfig;
const loginCsrfToken = "C".repeat(43);

beforeAll(async () => {
  const base = fleetTestConfig();
  config = {
    ...base,
    auth: {
      ...base.auth,
      passwordHash: await Bun.password.hash("terminal-route-password", {
        algorithm: "argon2id",
        memoryCost: 4_096,
        timeCost: 1,
      }),
    },
  };
});

/** Records what the server would have been asked to upgrade, and whether it was asked at all. */
function recorder(succeeds = true) {
  const seen: TerminalUpgrade[] = [];
  return {
    seen,
    upgrade: (_request: Request, data: TerminalUpgrade) => {
      seen.push(data);
      return succeeds;
    },
  };
}

/**
 * Every temporary root this file made, removed when it is done.
 *
 * Its own prefix, too: the Gateway's terminal SOCKET directories share the tmp directory, and one
 * name for both is one name to confuse when something is left behind — which is how this leak went
 * unnoticed for three hundred runs.
 */
const roots: string[] = [];

afterAll(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

async function setup() {
  const root = await mkdtemp(join(tmpdir(), "herdr-fleet-route-test-"));
  roots.push(root);
  const sessions = new SessionStore(join(root, "sessions.json"));
  const handler = createGatewayHandler({
    config,
    sessions,
    limiter: new LoginRateLimiter(config.auth.rateLimit),
    // Any call to the upstream would be a bug in these tests: a terminal request must never reach
    // the proxy, whether it is admitted or refused.
    // SAFETY: the assertion only widens a function that always throws into the fetcher's signature.
    // It is never called — that is the assertion this fetcher exists to make — so no value of the
    // asserted type is ever produced.
    fetcher: (async () => {
      throw new Error("the terminal route must not reach the upstream");
    }) as never,
    now: () => 1_000,
    loginCsrfToken,
  });
  return { sessions, handler };
}

async function login(handler: Awaited<ReturnType<typeof setup>>["handler"]): Promise<string> {
  const headers = new Headers({
    "content-type": "application/x-www-form-urlencoded",
    origin: config.public.origin,
    host: config.public.host,
    "x-forwarded-for": "192.0.2.9",
  });
  const response = await handler(
    new Request(`${config.public.origin}/auth/login`, {
      method: "POST",
      headers,
      body: new URLSearchParams({ username: "operator", password: "terminal-route-password", next: "/" }),
    }),
    { peerAddress: "127.0.0.1" },
  );
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
  if (cookie === undefined) throw new Error("login did not issue a cookie");
  return cookie;
}

function ask(search: string, extra: { cookie?: string; origin?: string | null } = {}): Request {
  const headers = new Headers({ host: config.public.host, upgrade: "websocket" });
  if (extra.cookie !== undefined) headers.set("cookie", extra.cookie);
  const origin = extra.origin === undefined ? config.public.origin : extra.origin;
  if (origin !== null) headers.set("origin", origin);
  return new Request(`${config.public.origin}${TERMINAL_PATH}${search}`, { headers });
}

describe("the terminal upgrade is authenticated before it completes", () => {
  test("an authenticated request is handed to the server with the Pane it named", async () => {
    const { handler } = await setup();
    const cookie = await login(handler);
    const server = recorder();
    const response = await handler(ask("?pane=w1:p2&h=laptop", { cookie }), {
      peerAddress: "127.0.0.1",
      upgrade: server.upgrade,
    });
    expect(response.status).toBe(101);
    expect(server.seen).toHaveLength(1);
    expect(server.seen[0]!.target).toEqual({ paneId: "w1:p2", host: "laptop" });
    expect(server.seen[0]!.session.sessionId).toMatch(/.+/);
  });

  test("an unauthenticated request is refused with 401, never a redirect a socket cannot follow", async () => {
    const { handler } = await setup();
    const server = recorder();
    const response = await handler(ask("?pane=w1:p2"), {
      peerAddress: "127.0.0.1",
      upgrade: server.upgrade,
    });
    expect(response.status).toBe(401);
    expect(response.headers.get("location")).toBeNull();
    expect(server.seen).toHaveLength(0);
  });

  test("a request for another Host never reaches the terminal route at all", async () => {
    const { handler } = await setup();
    const cookie = await login(handler);
    const server = recorder();
    const headers = new Headers({ host: "elsewhere.example", origin: config.public.origin, cookie });
    const response = await handler(
      new Request(`${config.public.origin}${TERMINAL_PATH}?pane=w1:p2`, { headers }),
      { peerAddress: "127.0.0.1", upgrade: server.upgrade },
    );
    expect(response.status).toBe(404);
    expect(server.seen).toHaveLength(0);
  });

  test("a wrong origin is refused even with a valid session", async () => {
    const { handler } = await setup();
    const cookie = await login(handler);
    const server = recorder();
    const response = await handler(
      ask("?pane=w1:p2", { cookie, origin: "https://evil.example" }),
      { peerAddress: "127.0.0.1", upgrade: server.upgrade },
    );
    expect(response.status).toBe(400);
    expect(server.seen).toHaveLength(0);
  });

  test("a missing origin is refused too", async () => {
    const { handler } = await setup();
    const cookie = await login(handler);
    const server = recorder();
    const response = await handler(ask("?pane=w1:p2", { cookie, origin: null }), {
      peerAddress: "127.0.0.1",
      upgrade: server.upgrade,
    });
    expect(response.status).toBe(400);
    expect(server.seen).toHaveLength(0);
  });

  test("a revoked session cannot open a terminal", async () => {
    const { handler, sessions } = await setup();
    const cookie = await login(handler);
    const server = recorder();
    const first = await handler(ask("?pane=w1:p2", { cookie }), {
      peerAddress: "127.0.0.1",
      upgrade: server.upgrade,
    });
    expect(first.status).toBe(101);
    await sessions.revoke(server.seen[0]!.session.sessionId, 1_000);
    const second = await handler(ask("?pane=w1:p2", { cookie }), {
      peerAddress: "127.0.0.1",
      upgrade: server.upgrade,
    });
    expect(second.status).toBe(401);
    expect(server.seen).toHaveLength(1);
  });
});

describe("what the route refuses to carry", () => {
  test("a terminal id is refused rather than ignored", async () => {
    const { handler } = await setup();
    const cookie = await login(handler);
    const server = recorder();
    const response = await handler(ask("?pane=w1:p2&terminal=term_abc", { cookie }), {
      peerAddress: "127.0.0.1",
      upgrade: server.upgrade,
    });
    expect(response.status).toBe(400);
    expect(server.seen).toHaveLength(0);
  });

  test("every refusal answers identically, so nothing about the Pane leaks", async () => {
    const { handler } = await setup();
    const cookie = await login(handler);
    const server = recorder();
    const bodies = new Set<string>();
    for (const search of ["", "?pane=", "?pane=nonsense", "?pane=w1:p2&cmd=bash"]) {
      const response = await handler(ask(search, { cookie }), {
        peerAddress: "127.0.0.1",
        upgrade: server.upgrade,
      });
      expect(response.status).toBe(400);
      bodies.add(await response.text());
    }
    expect(bodies.size).toBe(1);
  });
});

describe("the route's place in the handler", () => {
  test("a server that cannot upgrade is refused rather than proxied", async () => {
    const { handler } = await setup();
    const cookie = await login(handler);
    const response = await handler(ask("?pane=w1:p2", { cookie }), { peerAddress: "127.0.0.1" });
    expect(response.status).toBe(400);
  });

  test("a failed upgrade is refused rather than proxied", async () => {
    const { handler } = await setup();
    const cookie = await login(handler);
    const server = recorder(false);
    const response = await handler(ask("?pane=w1:p2", { cookie }), {
      peerAddress: "127.0.0.1",
      upgrade: server.upgrade,
    });
    expect(response.status).toBe(400);
  });
});
