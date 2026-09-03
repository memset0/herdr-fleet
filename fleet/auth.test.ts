import { beforeAll, describe, expect, test } from "bun:test";

import {
  clearSessionCookie,
  cookieValue,
  createSessionToken,
  attemptLogin,
  readLoginForm,
  safeReturnPath,
  sameOriginPost,
  sessionCookie,
  verifyCredentials,
  verifySessionToken,
} from "./auth.ts";
import type { FleetConfig } from "./config.ts";
import { LoginRateLimiter } from "./rate-limit.ts";
import { fleetTestConfig } from "./test-helpers.ts";

let config: FleetConfig;

beforeAll(async () => {
  const base = fleetTestConfig();
  config = {
    ...base,
    auth: {
      ...base.auth,
      passwordHash: await Bun.password.hash("correct horse battery staple", {
        algorithm: "argon2id",
        memoryCost: 4_096,
        timeCost: 1,
      }),
    },
  };
});

describe("Fleet authentication", () => {
  test("signs bounded sessions and rejects tamper, future, expiry, and secret rotation", () => {
    const id = "A".repeat(43);
    const created = createSessionToken(config, 1_000, () => id);
    expect(verifySessionToken(created.token, config, 1_000)).toEqual({
      version: 1,
      sessionId: id,
      issuedAt: 1_000,
      expiresAt: 3_601_000,
    });
    expect(verifySessionToken(`${created.token.slice(0, -1)}x`, config, 1_000)).toBeNull();
    expect(verifySessionToken("x".repeat(2_000), config, 1_000)).toBeNull();
    expect(verifySessionToken(created.token, config, created.expiresAt)).toBeNull();
    expect(verifySessionToken(created.token, config, -60_001)).toBeNull();
    const rotated = { ...config, auth: { ...config.auth, sessionSecret: Buffer.alloc(32, 12).toString("base64url") } };
    expect(verifySessionToken(created.token, rotated, 1_000)).toBeNull();
  });

  test("issues one host-only strict cookie and clears the same scope", () => {
    const issued = sessionCookie(config, "token");
    expect(issued).toStartWith("__Host-herdr_fleet_session=token;");
    expect(issued).toContain("Path=/; Max-Age=3600; Secure; HttpOnly; SameSite=Strict");
    expect(issued).not.toContain("Domain=");
    expect(clearSessionCookie()).toBe(
      "__Host-herdr_fleet_session=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Strict",
    );
    expect(cookieValue("a=1; session=first; session=second", "session")).toBeNull();
  });

  test("verifies the password path for correct and generic incorrect credentials", async () => {
    await expect(verifyCredentials({ username: "operator", password: "correct horse battery staple" }, config)).resolves.toBeTrue();
    await expect(verifyCredentials({ username: "intruder", password: "correct horse battery staple" }, config)).resolves.toBeFalse();
    await expect(verifyCredentials({ username: "operator", password: "wrong" }, config)).resolves.toBeFalse();
  });

  test("does not spend Argon2 work while a source or aggregate budget is blocked", async () => {
    const limiter = new LoginRateLimiter(config.auth.rateLimit);
    const input = { username: "operator", password: "wrong", returnPath: "/", csrfToken: "" };
    let calls = 0;
    const verifier = async () => {
      calls += 1;
      return false;
    };
    await attemptLogin(input, "source", config, limiter, verifier);
    await attemptLogin(input, "source", config, limiter, verifier);
    const blocked = await attemptLogin(input, "source", config, limiter, verifier);
    expect(blocked.accepted).toBeFalse();
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(calls).toBe(2);
  });

  test("accepts internal return paths and rejects authority or parser ambiguity", () => {
    expect(safeReturnPath("/pane/p1?session=demo#latest")).toBe("/pane/p1?session=demo#latest");
    for (const unsafe of [
      "https://evil.example/",
      "//evil.example/",
      "/%2f%2fevil.example/",
      "/%252f%252fevil.example/",
      "/%2e%2e//evil.example/",
      "/\\evil.example/",
      "/%5cevil.example/",
      "/line\nfeed",
      "/bad%escape",
    ]) {
      expect(safeReturnPath(unsafe)).toBe("/");
    }
  });

  test("requires exact-origin POST for login transitions", () => {
    const request = (headers: HeadersInit) =>
      new Request("https://fleet.example.com/auth/login", { method: "POST", headers });
    expect(sameOriginPost(request({ origin: "https://fleet.example.com" }), config.public.origin)).toBeTrue();
    expect(sameOriginPost(request({ referer: "https://fleet.example.com/auth/login" }), config.public.origin)).toBeTrue();
    expect(sameOriginPost(request({ origin: "https://evil.example" }), config.public.origin)).toBeFalse();
    expect(sameOriginPost(new Request("https://fleet.example.com/auth/login"), config.public.origin)).toBeFalse();
  });

  test("parses only bounded urlencoded credentials without reflecting values", async () => {
    const form = (body: URLSearchParams, headers: HeadersInit = {}) =>
      new Request("https://fleet.example.com/auth/login", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
        body,
      });
    await expect(
      readLoginForm(
        form(
          new URLSearchParams({
            username: "operator",
            password: "correct horse battery staple",
            next: "/pane/p1",
            csrf_token: "C".repeat(43),
          }),
        ),
      ),
    ).resolves.toEqual({
      username: "operator",
      password: "correct horse battery staple",
      returnPath: "/pane/p1",
      csrfToken: "C".repeat(43),
    });
    await expect(readLoginForm(form(new URLSearchParams({ username: "x".repeat(65), password: "secret" })))).resolves.toBeNull();
    await expect(
      readLoginForm(
        new Request("https://fleet.example.com/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        }),
      ),
    ).resolves.toBeNull();
  });
});
