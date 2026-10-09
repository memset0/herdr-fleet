import { describe, expect, test } from "bun:test";

import type { JsonValue } from "../../bridge/json.ts";
import type { MemberTerminalEndpoint } from "../terminal/resolve.ts";
import type { LocalPaneFit } from "./local.ts";
import { isPaneFitPath, paneFitResponse, readMemberAnswer, type PaneFitRouteDeps } from "./route.ts";

const ORIGIN = "https://fleet.example.test";
const MEMBERS: MemberTerminalEndpoint[] = [
  { memberId: "member-a", terminal: { host: "127.0.0.1", port: 18_911 } },
  { memberId: "member-b" },
];

function localFit(calls: Array<[string, number]>): LocalPaneFit {
  return {
    resize: async (paneId, cols) => {
      calls.push([paneId, cols]);
      return { ok: true, cols, rows: 31 };
    },
    held: () => 0,
    dispose: () => undefined,
  };
}

function harness(over: Partial<PaneFitRouteDeps> = {}) {
  const local: Array<[string, number]> = [];
  const posts: Array<{ url: string; body: string }> = [];
  const logs: Array<Record<string, string | number>> = [];
  const deps: PaneFitRouteDeps = {
    local: localFit(local),
    members: () => MEMBERS,
    post: async (url, body) => {
      posts.push({ url, body });
      return Response.json({ ok: true, cols: 96, rows: 44 });
    },
    log: (_event, detail) => void logs.push(detail),
    ...over,
  };
  const ask = (path: string, init: RequestInit = {}) => {
    const request = new Request(`${ORIGIN}${path}`, init);
    return paneFitResponse(request, new URL(request.url), deps);
  };
  const resize = (path: string, body: JsonValue) =>
    ask(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { ask, resize, local, posts, logs };
}

describe("the routes this module answers", () => {
  test("only its two paths", () => {
    expect(isPaneFitPath("/fleet/api/pane-fit")).toBe(true);
    expect(isPaneFitPath("/fleet/api/pane/w1%3Ap1/resize")).toBe(true);
    expect(isPaneFitPath("/fleet/api/pane/w1%3Ap1")).toBe(false);
    expect(isPaneFitPath("/api/pane/w1:p1/resize")).toBe(false);
  });

  test("availability names the lead and every member with a terminal endpoint", async () => {
    const h = harness();
    expect(await h.ask("/fleet/api/pane-fit")).toEqual({ status: 200, body: { lead: true, members: ["member-a"] } });
    const without = harness({ local: null });
    expect((await without.ask("/fleet/api/pane-fit"))?.body).toEqual({ lead: false, members: ["member-a"] });
  });
});

describe("a lead Pane", () => {
  test("is fitted locally and logged once", async () => {
    const h = harness();
    expect(await h.resize("/fleet/api/pane/w1%3Ap1/resize", { cols: 80 })).toEqual({
      status: 200,
      body: { ok: true, cols: 80, rows: 31 },
    });
    expect(h.local).toEqual([["w1:p1", 80]]);
    expect(h.posts).toEqual([]);
    expect(h.logs).toEqual([{ pane: "w1:p1", host: "lead", cols: 80, outcome: "resized", rows: 31 }]);
  });

  test("is unsupported when this machine cannot run the multiplexer", async () => {
    const h = harness({ local: null });
    expect((await h.resize("/fleet/api/pane/w1%3Ap1/resize", { cols: 80 }))?.body).toMatchObject({
      ok: false,
      reason: "unsupported",
    });
  });
});

describe("a member's Pane", () => {
  test("is fitted by that member's own terminal service, with only the Pane and the columns", async () => {
    const h = harness();
    const answer = await h.resize("/fleet/api/pane/w1%3Ap1/resize?h=member-a", { cols: 96 });
    expect(answer).toEqual({ status: 200, body: { ok: true, cols: 96, rows: 44 } });
    expect(h.posts).toEqual([{ url: "http://127.0.0.1:18911/terminal/resize", body: '{"pane":"w1:p1","cols":96}' }]);
    expect(h.local).toEqual([]);
  });

  test("a member without a terminal endpoint, or unknown, is unsupported and nothing is sent", async () => {
    const h = harness();
    for (const host of ["member-b", "member-z"]) {
      expect((await h.resize(`/fleet/api/pane/w1%3Ap1/resize?h=${host}`, { cols: 96 }))?.body).toMatchObject({
        ok: false,
        reason: "unsupported",
      });
    }
    expect(h.posts).toEqual([]);
  });

  test("a member that has not been levelled, or cannot be reached, is a failed resize", async () => {
    const stale = harness({ post: async () => Response.json({ error: "refused", at: "path" }, { status: 400 }) });
    expect((await stale.resize("/fleet/api/pane/w1%3Ap1/resize?h=member-a", { cols: 96 }))?.body).toMatchObject({
      ok: false,
      reason: "failed",
    });
    const gone = harness({
      post: async () => {
        throw new Error("connection refused");
      },
    });
    expect((await gone.resize("/fleet/api/pane/w1%3Ap1/resize?h=member-a", { cols: 96 }))?.body).toMatchObject({
      ok: false,
      reason: "failed",
    });
  });
});

describe("what the route refuses", () => {
  test.each([
    ["a row count", { cols: 80, rows: 40 }],
    ["columns out of range", { cols: 19 }],
    ["fractional columns", { cols: 80.5 }],
    ["a string", { cols: "80" }],
    ["no body object", [80]],
  ])("a body with %s", async (_label, body) => {
    const h = harness();
    expect((await h.resize("/fleet/api/pane/w1%3Ap1/resize", body))?.status).toBe(400);
    expect(h.local).toEqual([]);
  });

  test("an extra query parameter, a malformed scope or a malformed Pane", async () => {
    const h = harness();
    for (const path of [
      "/fleet/api/pane/w1%3Ap1/resize?socket=/tmp/x",
      "/fleet/api/pane/w1%3Ap1/resize?h=../x",
      "/fleet/api/pane/not-a-pane/resize",
    ]) {
      expect((await h.resize(path, { cols: 80 }))?.status).toBe(400);
    }
    expect(h.local).toEqual([]);
    expect(h.posts).toEqual([]);
  });

  test("the wrong method", async () => {
    const h = harness();
    expect((await h.ask("/fleet/api/pane/w1%3Ap1/resize"))?.status).toBe(405);
    expect((await h.ask("/fleet/api/pane-fit", { method: "POST" }))?.status).toBe(405);
  });
});

describe("a member's answer", () => {
  test("is narrowed to a result or a closed failure", () => {
    expect(readMemberAnswer(200, { ok: true, cols: 96, rows: 44 })).toEqual({ ok: true, cols: 96, rows: 44 });
    expect(readMemberAnswer(200, { ok: false, reason: "conflict" })).toMatchObject({ reason: "conflict" });
    expect(readMemberAnswer(200, { ok: false, reason: "exploded" })).toMatchObject({ reason: "failed" });
    expect(readMemberAnswer(200, { ok: true, cols: 96 })).toMatchObject({ reason: "failed" });
    expect(readMemberAnswer(500, { ok: true, cols: 96, rows: 44 })).toMatchObject({ reason: "failed" });
  });
});
