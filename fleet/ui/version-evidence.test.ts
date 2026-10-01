import { describe, expect, test } from "bun:test";

import { classifyHostVersion } from "./version-evidence.ts";

const LEAD = "3.5.3+0123abc";

describe("Host version evidence against the lead", () => {
  test("compares major.minor with the lead, ignoring patch and build identity", () => {
    expect(classifyHostVersion({ reported: "3.5.3+0123abc", answering: true, lead: LEAD })).toMatchObject({
      reported: "3.5.3+0123abc",
      state: "compatible",
      development: false,
    });
    expect(classifyHostVersion({ reported: "3.5.0", answering: true, lead: LEAD })).toMatchObject({
      state: "compatible",
    });
    expect(classifyHostVersion({ reported: "3.4.9+fedcba9", answering: true, lead: LEAD })).toMatchObject({
      reported: "3.4.9+fedcba9",
      state: "outdated",
    });
    expect(classifyHostVersion({ reported: "3.9.0", answering: true, lead: "4.0.1" })).toMatchObject({
      state: "manual-major",
    });
    // A member ahead of the lead is not behind it.
    expect(classifyHostVersion({ reported: "3.6.0", answering: true, lead: LEAD })).toMatchObject({
      state: "compatible",
    });
  });

  test("uses a development lead's numbers as the reference", () => {
    expect(classifyHostVersion({ reported: "3.5.2", answering: true, lead: "3.6.0-dev+0123abc" })).toMatchObject({
      state: "outdated",
    });
    expect(classifyHostVersion({ reported: "3.6.0", answering: true, lead: "3.6.0-dev+0123abc" })).toMatchObject({
      state: "compatible",
    });
  });

  test("keeps development and last-reported qualification ahead of the comparison", () => {
    expect(classifyHostVersion({ reported: "3.3.0-dev+2fc727c", answering: true, lead: LEAD })).toMatchObject({
      state: "development",
      development: true,
    });
    expect(classifyHostVersion({ reported: "3.3.0-dev+2fc727c", answering: false, lead: LEAD })).toMatchObject({
      state: "last-reported",
      development: true,
    });
    expect(classifyHostVersion({ reported: "3.4.0", answering: false, lead: null })).toMatchObject({
      state: "last-reported",
      development: false,
    });
  });

  test("asserts nothing without a parseable member identity or lead reference", () => {
    expect(classifyHostVersion({ reported: "not-semver", answering: true, lead: LEAD })).toMatchObject({
      state: "unknown",
    });
    expect(classifyHostVersion({ answering: true, lead: LEAD })).toMatchObject({ reported: null, state: "unknown" });
    expect(classifyHostVersion({ reported: "3.5.3", answering: true, lead: null })).toMatchObject({
      reported: "3.5.3",
      state: "unknown",
    });
    expect(classifyHostVersion({ reported: "3.5.3", answering: true, lead: "unknown" })).toMatchObject({
      state: "unknown",
    });
  });
});
