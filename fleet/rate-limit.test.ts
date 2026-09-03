import { describe, expect, test } from "bun:test";

import { LoginRateLimiter } from "./rate-limit.ts";
import { fleetTestConfig } from "./test-helpers.ts";

describe("login rate limits", () => {
  test("blocks per source, recovers, and does not let success clear another source", () => {
    const limiter = new LoginRateLimiter(fleetTestConfig().auth.rateLimit);
    limiter.failure("first", 1_000);
    limiter.failure("first", 2_000);
    expect(limiter.allowed("first", 2_000)).toEqual({ allowed: false, retryAfterSeconds: 20 });
    expect(limiter.allowed("second", 2_000).allowed).toBeTrue();
    limiter.failure("second", 2_000);
    limiter.success("first");
    limiter.failure("second", 3_000);
    expect(limiter.allowed("second", 3_000).allowed).toBeFalse();
    expect(limiter.allowed("first", 33_001).allowed).toBeTrue();
  });

  test("bounds source memory while aggregate protection survives rotation", () => {
    const limiter = new LoginRateLimiter(fleetTestConfig().auth.rateLimit);
    limiter.failure("one", 1);
    limiter.failure("two", 2);
    limiter.failure("three", 3);
    expect(limiter.sourceCount).toBe(2);
    limiter.failure("four", 4);
    expect(limiter.allowed("new-source", 4)).toEqual({ allowed: false, retryAfterSeconds: 30 });
  });
});
