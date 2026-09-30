import { describe, expect, test, vi } from "bun:test";
import { setImmediate } from "node:timers/promises";

import {
  createFleetReleaseObserver,
  selectFleetStableReleases,
  type ReleaseFetcher,
} from "./release-observer.ts";

const ref = (version: string, type: "tag" | "commit" = "tag") => ({
  ref: `refs/tags/v${version}`,
  object: { type, sha: "a".repeat(40), url: "https://example.invalid/object" },
});

describe("Fleet release observation", () => {
  test("selects annotated stable tags numerically and rejects lookalikes", () => {
    expect(
      selectFleetStableReleases([
        ref("3.9.7"),
        ref("3.10.0"),
        ref("4.0.0"),
        ref("4.1.0", "commit"),
        ref("4.2.0-rc.1"),
        { ref: "refs/tags/latest", object: { type: "tag" } },
      ]),
    ).toEqual({
      latest: "4.0.0",
      majors: [
        { major: 3, version: "3.10.0" },
        { major: 4, version: "4.0.0" },
      ],
    });
  });

  test("returns immediately, shares one refresh, and retains stale success through failure", async () => {
    let now = 1_000;
    let calls = 0;
    let releaseFirst: ((response: Response) => void) | undefined;
    const first = new Promise<Response>((resolve) => {
      releaseFirst = resolve;
    });
    const fetcher: ReleaseFetcher = async () => {
      calls += 1;
      if (calls === 1) return first;
      throw new Error("offline");
    };
    const observer = createFleetReleaseObserver({
      fetcher,
      now: () => now,
      freshMs: 100,
      retryMs: 50,
    });

    expect(observer.observe().freshness).toBe("unavailable");
    expect(observer.observe().freshness).toBe("unavailable");
    expect(calls).toBe(1);
    if (releaseFirst === undefined) throw new Error("first fetch was not started");
    releaseFirst(Response.json([ref("3.3.0")]));
    // Yield one event-loop turn so the response and observer promise reactions finish.
    await setImmediate();
    expect(observer.observe()).toMatchObject({
      latest: "3.3.0",
      checkedAt: 1_000,
      freshUntil: 1_100,
      freshness: "fresh",
    });

    now = 1_101;
    expect(observer.observe()).toMatchObject({ latest: "3.3.0", freshness: "stale" });
    await setImmediate();
    expect(observer.observe()).toMatchObject({
      latest: "3.3.0",
      checkedAt: 1_000,
      freshness: "stale",
    });
    expect(calls).toBe(2);
    now = 1_152;
    observer.observe();
    expect(calls).toBe(3);
    await setImmediate();
  });

  test("aborts a source that exceeds the observer deadline", async () => {
    vi.useFakeTimers();
    try {
      let aborted = false;
      const observer = createFleetReleaseObserver({
        fetcher: async (_input, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener(
              "abort",
              () => {
                aborted = true;
                reject(new DOMException("timed out", "AbortError"));
              },
              { once: true },
            );
          }),
        now: () => 1_000,
        timeoutMs: 25,
      });
      expect(observer.observe().freshness).toBe("unavailable");
      vi.advanceTimersByTime(25);
      expect(aborted).toBe(true);
      await Promise.resolve();
    } finally {
      vi.useRealTimers();
    }
  });

  test("rejects oversized declared and streamed responses that otherwise contain valid tags", async () => {
    for (const response of [
      Response.json([ref("3.3.0")], { headers: { "content-length": "262145" } }),
      Response.json([{ ...ref("3.3.0"), padding: "x".repeat(262144) }]),
    ]) {
      const observer = createFleetReleaseObserver({ fetcher: async () => response });
      observer.observe();
      await setImmediate();
      expect(observer.observe()).toMatchObject({ latest: null, freshness: "unavailable" });
    }
  });
});
