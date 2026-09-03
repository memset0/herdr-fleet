import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  closeWorkspace,
  fetchHistory,
  fetchPane,
  fetchSnapshot,
  registerPaneObservationProvider,
  renameWorkspace,
  resizePane,
  sendReply,
} from "@/lib/api";
import { server } from "@/test/setup";

describe("Fleet API ports", () => {
  it("renames and closes a Space through exact session-scoped routes", async () => {
    const requests: Array<{ url: string; body: unknown }> = [];
    server.use(
      http.post(/\/api\/workspace\/[^/]+\/(rename|close)$/, async ({ request }) => {
        requests.push({
          url: request.url,
          body: request.url.includes("/rename") ? await request.json() : null,
        });
        return HttpResponse.json({ ok: true });
      }),
    );

    await expect(renameWorkspace("w1", "Demo", "batch-a")).resolves.toEqual({ ok: true });
    await expect(closeWorkspace("w1", "batch-a")).resolves.toEqual({ ok: true });
    expect(requests).toEqual([
      {
        url: expect.stringContaining("/api/workspace/w1/rename?session=batch-a"),
        body: { label: "Demo" },
      },
      {
        url: expect.stringContaining("/api/workspace/w1/close?session=batch-a"),
        body: null,
      },
    ]);
  });

  it("posts resize columns to the exact session-scoped action", async () => {
    let seen: { url: string; body: unknown } | undefined;
    server.use(
      http.post(/\/api\/pane\/[^/]+\/resize$/, async ({ request }) => {
        seen = { url: request.url, body: await request.json() };
        return HttpResponse.json({ ok: true, cols: 64, rows: 31 });
      }),
    );

    await expect(resizePane("w1:p1", 64, "demo")).resolves.toEqual({
      ok: true,
      cols: 64,
      rows: 31,
    });
    expect(seen?.url).toContain("/api/pane/w1%3Ap1/resize?session=demo");
    expect(seen?.body).toEqual({ cols: 64 });
  });
});

describe("Fleet Pane observation port", () => {
  let resetObservation: (() => void) | undefined;

  afterEach(() => {
    resetObservation?.();
    resetObservation = undefined;
    vi.restoreAllMocks();
  });

  function captureHeaders() {
    const seen: Array<{ url: string; method: string; headers: Headers }> = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      seen.push({
        url: String(input),
        method: init?.method ?? "GET",
        headers: new Headers(init?.headers),
      });
      return new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    return seen;
  }

  it("omits x-collie-seen from inactive Pane and History reads", async () => {
    const seen = captureHeaders();
    resetObservation = registerPaneObservationProvider(() => false);

    await fetchPane("w-seen:p-hidden");
    await fetchHistory("w-seen:p-hidden");

    expect(seen).toHaveLength(2);
    for (const request of seen) expect(request.headers.get("x-collie-seen")).toBeNull();
  });

  it("adds x-collie-seen to active Pane and History reads", async () => {
    const seen = captureHeaders();
    resetObservation = registerPaneObservationProvider(() => true);

    await fetchPane("w-seen:p-active");
    await fetchHistory("w-seen:p-active");

    expect(seen).toHaveLength(2);
    for (const request of seen) expect(request.headers.get("x-collie-seen")).toBe("1");
  });

  it("never attributes snapshots and leaves writes independent from the read header", async () => {
    const seen = captureHeaders();
    resetObservation = registerPaneObservationProvider(() => false);

    await fetchSnapshot();
    await sendReply("w-seen:p-hidden", "hello");

    expect(seen[0]).toMatchObject({ url: "/api/snapshot", method: "GET" });
    expect(seen[0]!.headers.get("x-collie-seen")).toBeNull();
    expect(seen[1]).toMatchObject({
      url: "/api/pane/w-seen%3Ap-hidden/reply",
      method: "POST",
    });
    expect(seen[1]!.headers.get("x-collie-seen")).toBeNull();
  });
});
