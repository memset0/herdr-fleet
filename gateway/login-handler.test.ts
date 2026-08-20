import { beforeAll, describe, expect, test } from "bun:test";

import { LoginRateLimiter } from "./auth.ts";
import { FleetCollector } from "./fleet.ts";
import { createGatewayHandler } from "./server.ts";
import { gatewayConfig } from "./test-helpers.ts";
import { TransportRegistry } from "./transports.ts";

let passwordHash = "";

beforeAll(async () => {
  passwordHash = await Bun.password.hash("gateway-login-test-password", {
    algorithm: "argon2id",
    memoryCost: 4_096,
    timeCost: 1,
  });
});

function request(path: string, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  headers.set("host", "fleet.example.com");
  return new Request(`https://fleet.example.com${path}`, { ...init, headers });
}

function setup(limiter?: LoginRateLimiter) {
  const config = gatewayConfig();
  config.auth.passwordHash = passwordHash;
  const transports = new TransportRegistry(config.nodes);
  const collector = new FleetCollector(
    config,
    transports,
    (async () => {
      throw new Error("login handler tests must not poll nodes");
    }) as unknown as typeof fetch,
  );
  return createGatewayHandler({ config, collector, transports, limiter });
}

function form(values: Record<string, string>, forwardedFor = "192.0.2.40"): RequestInit {
  return {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-forwarded-for": forwardedFor,
    },
    body: new URLSearchParams(values),
  };
}

describe("Gateway login document responses", () => {
  test("serves the public unversioned stylesheet with revalidation and security headers", async () => {
    const response = await setup()(request("/auth/app.css"));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/css; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("no-cache");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(body).toContain("color-scheme: light dark");
    expect(body).toContain(".login-shell");
  });

  test("renders the initial script-free page with a safe fallback return and unchanged CSP", async () => {
    const response = await setup()(request("/auth/login?next=https%3A%2F%2Fevil.example%2Fsteal"));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-security-policy")).toContain("form-action 'self'");
    expect(response.headers.get("content-security-policy")).not.toContain("unsafe-inline");
    expect(body).toContain('<input type="hidden" name="next" value="https://fleet.example.com/">');
    expect(body).not.toContain("evil.example");
    expect(body).not.toContain("<script");
  });

  test("keeps invalid and malformed submissions escaped inside the same alert surface", async () => {
    const handler = setup();
    const invalid = await handler(request("/auth/login", form({
      username: "operator",
      password: "must-not-echo",
      next: "https://local.example.com/pane/p1?session=demo",
    })));
    const invalidBody = await invalid.text();

    expect(invalid.status).toBe(401);
    expect(invalidBody).toContain('id="login-alert" class="alert" role="alert"');
    expect(invalidBody).toContain("Invalid username or password.");
    expect(invalidBody).toContain("https://local.example.com/pane/p1?session=demo");
    expect(invalidBody).not.toContain("must-not-echo");

    const malformed = await handler(request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: '{"password":"must-not-echo-either"}',
    }));
    const malformedBody = await malformed.text();
    expect(malformed.status).toBe(400);
    expect(malformedBody).toContain('role="alert"');
    expect(malformedBody).toContain("unsupported form content type");
    expect(malformedBody).not.toContain("must-not-echo-either");
  });

  test("renders the generic throttled state without attempting another credential check", async () => {
    const handler = setup(new LoginRateLimiter(1, 10_000, 20_000));
    const attempt = () => handler(request("/auth/login", form({ username: "operator", password: "wrong" })));

    expect((await attempt()).status).toBe(401);
    const throttled = await attempt();
    const body = await throttled.text();
    expect(throttled.status).toBe(429);
    expect(body).toContain('id="login-alert" class="alert" role="alert"');
    expect(body).toContain("Too many attempts. Try again later.");
    expect(body).not.toContain("wrong");
  });

  test("submits successfully without client JavaScript and preserves session semantics", async () => {
    const response = await setup()(request("/auth/login", form({
      username: "operator",
      password: "gateway-login-test-password",
      next: "https://local.example.com/pane/p1?session=demo",
    })));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://local.example.com/pane/p1?session=demo");
    expect(response.headers.get("set-cookie")).toContain("herdr_web_session=");
    expect(response.headers.get("set-cookie")).toContain("Secure; HttpOnly; SameSite=Lax");
  });
});
