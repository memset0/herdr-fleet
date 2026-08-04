import { beforeAll, describe, expect, test } from "bun:test";

import {
  clearSessionCookie,
  createSessionToken,
  LoginRateLimiter,
  safeReturnUrl,
  sessionCookie,
  verifyCredentials,
  verifySessionToken,
} from "./auth.ts";
import { gatewayConfig } from "./test-helpers.ts";

const config = gatewayConfig();
beforeAll(async () => {
  config.auth.passwordHash = await Bun.password.hash("correct horse battery staple", {
    algorithm: "argon2id",
    memoryCost: 4_096,
    timeCost: 1,
  });
});

describe("single-account authentication", () => {
  test("verifies both username and Argon2id password", async () => {
    expect(await verifyCredentials("operator", "correct horse battery staple", config)).toBeTrue();
    expect(await verifyCredentials("intruder", "correct horse battery staple", config)).toBeFalse();
    expect(await verifyCredentials("operator", "wrong", config)).toBeFalse();
  });

  test("signs expiring tokens and rejects tampering", () => {
    const now = 1_000_000;
    const token = createSessionToken(config, now);
    expect(verifySessionToken(token, config, now + 10)).toBeTrue();
    expect(verifySessionToken(`${token}x`, config, now + 10)).toBeFalse();
    expect(verifySessionToken(token, config, now + config.public.sessionTtlSeconds * 1_000)).toBeFalse();
  });

  test("issues and clears a hardened cross-subdomain cookie", () => {
    const issued = sessionCookie(config, "token");
    expect(issued).toContain("Domain=.example.com");
    expect(issued).toContain("Secure");
    expect(issued).toContain("HttpOnly");
    expect(issued).toContain("SameSite=Lax");
    expect(clearSessionCookie(config)).toContain("Max-Age=0");
  });

  test("allows return URLs only on configured HTTPS hosts", () => {
    expect(safeReturnUrl("https://local.example.com/pane/p1?session=demo", config)).toBe(
      "https://local.example.com/pane/p1?session=demo",
    );
    expect(safeReturnUrl("https://evil.example.net/steal", config)).toBe("https://fleet.example.com/");
    expect(safeReturnUrl("http://local.example.com/", config)).toBe("https://fleet.example.com/");
    expect(safeReturnUrl("//evil.example.net/", config)).toBe("https://fleet.example.com/");
  });

  test("rate-limits a source and clears successful history", () => {
    const limiter = new LoginRateLimiter(2, 1_000, 2_000);
    limiter.failure("client", 100);
    expect(limiter.allowed("client", 150)).toBeTrue();
    limiter.failure("client", 200);
    expect(limiter.allowed("client", 250)).toBeFalse();
    expect(limiter.allowed("client", 2_201)).toBeTrue();
    limiter.success("client");
    expect(limiter.allowed("client", 300)).toBeTrue();
  });

  test("bounds abandoned source entries", () => {
    const limiter = new LoginRateLimiter(1, 10_000, 10_000, 2);
    limiter.failure("oldest", 1);
    limiter.failure("second", 2);
    expect(limiter.allowed("oldest", 3)).toBeFalse();
    limiter.failure("third", 3);
    expect(limiter.allowed("oldest", 4)).toBeTrue();
    expect(limiter.allowed("second", 4)).toBeFalse();
    expect(limiter.allowed("third", 4)).toBeFalse();
  });
});
