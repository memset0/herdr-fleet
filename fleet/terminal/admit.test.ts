import { describe, expect, test } from "bun:test";

import { TERMINAL_PATH, admit, type AdmissionConfig } from "./admit.ts";

const config: AdmissionConfig = {
  publicHost: "fleet.example.com",
  publicOrigin: "https://fleet.example.com",
};

function ask(
  search: string,
  over: Partial<{ host: string; origin: string | null; authenticated: boolean }> = {},
) {
  return admit(
    {
      url: new URL(`https://fleet.example.com${TERMINAL_PATH}${search}`),
      host: over.host ?? config.publicHost,
      origin: over.origin === undefined ? config.publicOrigin : over.origin,
      authenticated: over.authenticated ?? true,
    },
    config,
  );
}

describe("what is admitted", () => {
  test("a Pane on the lead, with no scope", () => {
    expect(ask("?pane=w1:p2")).toEqual({ ok: true, target: { paneId: "w1:p2" } });
  });

  test("a Pane on a member, in a named session", () => {
    expect(ask("?pane=w1:p2&h=laptop&s=work")).toEqual({
      ok: true,
      target: { paneId: "w1:p2", host: "laptop", session: "work" },
    });
  });

  test("an absent scope stays absent rather than becoming undefined keys", () => {
    const admitted = ask("?pane=w1:p2");
    if (!admitted.ok) throw new Error("unreachable");
    expect(Object.keys(admitted.target)).toEqual(["paneId"]);
  });
});

describe("the session gate", () => {
  test("an unauthenticated request is refused", () => {
    expect(ask("?pane=w1:p2", { authenticated: false })).toEqual({ ok: false, reason: "no-session" });
  });

  test("the host is checked before anything a caller supplies", () => {
    expect(ask("?pane=w1:p2", { host: "elsewhere.example.com", authenticated: false }))
      .toEqual({ ok: false, reason: "wrong-host" });
  });

  test("a wrong origin is refused even with a session", () => {
    expect(ask("?pane=w1:p2", { origin: "https://evil.example.com" }))
      .toEqual({ ok: false, reason: "wrong-origin" });
  });

  test("a missing origin is refused too — a browser always sends one on a handshake", () => {
    expect(ask("?pane=w1:p2", { origin: null })).toEqual({ ok: false, reason: "wrong-origin" });
  });
});

describe("what a connection may name", () => {
  test("no Pane at all is refused", () => {
    expect(ask("")).toEqual({ ok: false, reason: "no-pane" });
    expect(ask("?pane=")).toEqual({ ok: false, reason: "no-pane" });
  });

  test("a terminal id is REFUSED rather than ignored", () => {
    const refused = ask("?pane=w1:p2&terminal=term_abc");
    expect(refused).toEqual({ ok: false, reason: "extra-selector", detail: "terminal" });
  });

  test.each([
    ["a command", "cmd=bash"],
    ["command arguments", "arg=-lc"],
    ["an executable path", "exe=%2Fbin%2Fsh"],
    ["a socket path", "socket=%2Frun%2Fherdr.sock"],
    ["a multiplexer session name", "session=named-session"],
    ["an account", "user=root"],
  ])("%s is refused", (_label, extra) => {
    const refused = ask(`?pane=w1:p2&${extra}`);
    expect(refused.ok).toBe(false);
    if (refused.ok) throw new Error("unreachable");
    expect(refused.reason).toBe("extra-selector");
  });

  test("`session` is not a synonym for the scope's `s` — it is an extra selector", () => {
    expect(ask("?pane=w1:p2&s=work").ok).toBe(true);
    expect(ask("?pane=w1:p2&session=work").ok).toBe(false);
  });

  test("a malformed Pane id is refused before anything looks it up", () => {
    for (const bad of ["../../etc/passwd", "w1", "w1:", ":p2", "w 1:p2", "w1:p2:p3"]) {
      const refused = ask(`?pane=${encodeURIComponent(bad)}`);
      expect(refused.ok).toBe(false);
      if (refused.ok) throw new Error("unreachable");
      expect(refused.reason).toBe("malformed-pane");
    }
  });

  test("a malformed scope value is refused the same way", () => {
    expect(ask("?pane=w1:p2&h=%2Fetc%2Fpasswd").ok).toBe(false);
    expect(ask("?pane=w1:p2&s=%20").ok).toBe(false);
  });
});

describe("the order the gates run in", () => {
  test("an unauthenticated caller learns nothing about the Pane it named", () => {
    const unknownPane = ask("?pane=w9:p9", { authenticated: false });
    const malformed = ask("?pane=nonsense", { authenticated: false });
    expect(unknownPane).toEqual(malformed);
  });
});
