import { describe, expect, test } from "bun:test";

import { ATTACH_PATH, CLOSE_PATH, STATE_PATH, readPeerRequest } from "./protocol.ts";

const base = "http://127.0.0.1:18903";
const ask = (path: string, over: Partial<Parameters<typeof readPeerRequest>[0]> = {}) =>
  readPeerRequest({ method: "GET", url: new URL(path, base), upgrade: false, ...over });

describe("the three operations", () => {
  test("attach names a Pane and becomes a stream", () => {
    expect(ask(`${ATTACH_PATH}?pane=w1:p1`, { upgrade: true })).toEqual({
      ok: true,
      operation: { kind: "attach", paneId: "w1:p1" },
    });
  });

  test("close names a Pane in a JSON body", () => {
    expect(ask(CLOSE_PATH, { method: "POST", body: { pane: "w1:p1" } })).toEqual({
      ok: true,
      operation: { kind: "close", paneId: "w1:p1" },
    });
  });

  test("state takes nothing at all", () => {
    expect(ask(STATE_PATH)).toEqual({ ok: true, operation: { kind: "state" } });
  });
});

describe("what the grammar refuses", () => {
  test("a fourth operation does not exist", () => {
    expect(ask("/terminal/start")).toEqual({
      ok: false,
      refusal: { at: "path", message: "this service answers three operations" },
    });
  });

  test.each([
    ["a terminal id", `${ATTACH_PATH}?pane=w1:p1&terminal=term_abc`, "terminal"],
    ["a command", `${ATTACH_PATH}?pane=w1:p1&cmd=sh`, "cmd"],
    ["an executable", `${ATTACH_PATH}?pane=w1:p1&exec=/bin/sh`, "exec"],
    ["a socket path", `${ATTACH_PATH}?pane=w1:p1&socket=/tmp/x.sock`, "socket"],
    ["an account", `${ATTACH_PATH}?pane=w1:p1&user=root`, "user"],
    ["a server selector", `${ATTACH_PATH}?pane=w1:p1&server=other`, "server"],
    ["an environment value", `${ATTACH_PATH}?pane=w1:p1&env=PATH%3D%2Fbin`, "env"],
  ])("attach refuses %s rather than ignoring it", (_label, path, at) => {
    const result = ask(path, { upgrade: true });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.refusal.at).toBe(at);
  });

  test.each([
    ["a terminal id", { pane: "w1:p1", terminal: "term_abc" }, "terminal"],
    ["a command", { pane: "w1:p1", command: "sh" }, "command"],
    ["an account", { pane: "w1:p1", user: "root" }, "user"],
  ])("close refuses %s in its body", (_label, body, at) => {
    const result = ask(CLOSE_PATH, { method: "POST", body });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.refusal.at).toBe(at);
  });

  test("a malformed or absent Pane id is refused on both operations", () => {
    for (const pane of ["", "not a pane", "../../etc/passwd", "w1:", ":p1"]) {
      expect(ask(`${ATTACH_PATH}?pane=${encodeURIComponent(pane)}`, { upgrade: true }).ok).toBe(false);
      expect(ask(CLOSE_PATH, { method: "POST", body: { pane } }).ok).toBe(false);
    }
    expect(ask(ATTACH_PATH, { upgrade: true }).ok).toBe(false);
  });

  test("the method and the stream are part of the shape", () => {
    expect(ask(ATTACH_PATH + "?pane=w1:p1", { upgrade: false }).ok).toBe(false);
    expect(ask(ATTACH_PATH + "?pane=w1:p1", { method: "POST", upgrade: true }).ok).toBe(false);
    expect(ask(CLOSE_PATH, { method: "GET", body: { pane: "w1:p1" } }).ok).toBe(false);
    expect(ask(CLOSE_PATH, { method: "POST", upgrade: true, body: { pane: "w1:p1" } }).ok).toBe(false);
    expect(ask(`${STATE_PATH}?held=1`).ok).toBe(false);
    expect(ask(`${CLOSE_PATH}?pane=w1:p1`, { method: "POST", body: { pane: "w1:p1" } }).ok).toBe(false);
  });

  test("a close with no object body is refused rather than defaulted", () => {
    expect(ask(CLOSE_PATH, { method: "POST" }).ok).toBe(false);
    expect(ask(CLOSE_PATH, { method: "POST", body: "w1:p1" }).ok).toBe(false);
    expect(ask(CLOSE_PATH, { method: "POST", body: ["w1:p1"] }).ok).toBe(false);
  });
});
