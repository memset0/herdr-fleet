import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  READ_RETRY_DELAYS_MS,
  READ_TIMEOUT_MS,
  __resetUpdateRunStore,
  getUpdateRunSnapshot,
  holdReadRetry,
  readUpdateState,
  retryUpdateRead,
} from "./update-run-store";
import type { UpdateCheckResponse } from "./types";

// Issue 400: a read of `GET /api/update/check` that FAILS is its own fact, apart from the bridge
// answering `preflight: null`, and a mounted card asks again on a growing wait. The API module is
// stubbed here because the schedule is the subject and it needs a clock; the card's wiring is pinned
// against MSW in `components/update-card.test.tsx`.

const fetchUpdateState = vi.hoisted(() => vi.fn());
vi.mock("./api", () => ({
  fetchUpdateState,
  fetchStandbyRun: vi.fn(() => Promise.reject(new Error("no deputy"))),
}));

const answer = (over: Partial<UpdateCheckResponse> = {}): UpdateCheckResponse => ({
  current: "1.19.2",
  latest: "1.20.0",
  latestUrl: null,
  releaseAvailable: true,
  majorAvailable: null,
  majorUrl: null,
  bridgeStale: false,
  checkedAt: 1,
  preflight: { schema: 1, verdict: "green", checks: [] },
  ...over,
});

beforeEach(() => {
  vi.useFakeTimers();
  __resetUpdateRunStore();
  fetchUpdateState.mockReset();
});

afterEach(() => {
  __resetUpdateRunStore();
  vi.useRealTimers();
});

describe("a failed read is not a null preflight", () => {
  it("records readFailed, and clears it on the next answer", async () => {
    fetchUpdateState.mockRejectedValueOnce(new TypeError("network"));
    await readUpdateState();
    expect(getUpdateRunSnapshot()).toMatchObject({ checked: true, readFailed: true, check: undefined });

    fetchUpdateState.mockResolvedValueOnce(answer());
    await readUpdateState();
    expect(getUpdateRunSnapshot()).toMatchObject({ checked: true, readFailed: false });
  });

  it("an answer of preflight: null is an answer, not a failed read", async () => {
    fetchUpdateState.mockResolvedValueOnce(answer({ preflight: null }));
    await readUpdateState();
    const snap = getUpdateRunSnapshot();
    expect(snap.readFailed).toBe(false);
    expect(snap.checked).toBe(true);
    expect(snap.check?.preflight).toBeNull();
  });

  it("gives the read the long leash, above the bridge's worst case", async () => {
    fetchUpdateState.mockResolvedValueOnce(answer());
    await readUpdateState();
    expect(fetchUpdateState).toHaveBeenCalledWith(undefined, READ_TIMEOUT_MS);
    // 5 s release check + 5 s crew sweep + 30 s fresh preflight.
    expect(READ_TIMEOUT_MS).toBeGreaterThan(40_000);
  });

  it("a read the caller aborted is not a failure of the bridge", async () => {
    const ac = new AbortController();
    ac.abort();
    fetchUpdateState.mockRejectedValueOnce(new DOMException("aborted", "AbortError"));
    await readUpdateState(ac.signal);
    expect(getUpdateRunSnapshot().readFailed).toBe(false);
  });
});

describe("the retry while a card is mounted", () => {
  it("asks again on a growing wait, and holds the last wait", async () => {
    fetchUpdateState.mockRejectedValue(new TypeError("network"));
    const release = holdReadRetry();
    await readUpdateState();
    expect(fetchUpdateState).toHaveBeenCalledTimes(1);

    let calls = 1;
    for (const wait of [...READ_RETRY_DELAYS_MS, READ_RETRY_DELAYS_MS.at(-1)!]) {
      await vi.advanceTimersByTimeAsync(wait - 1);
      expect(fetchUpdateState).toHaveBeenCalledTimes(calls);
      await vi.advanceTimersByTimeAsync(1);
      calls += 1;
      expect(fetchUpdateState).toHaveBeenCalledTimes(calls);
    }
    release();
  });

  it("stops on success", async () => {
    fetchUpdateState.mockRejectedValueOnce(new TypeError("network")).mockResolvedValue(answer());
    const release = holdReadRetry();
    await readUpdateState();
    await vi.advanceTimersByTimeAsync(READ_RETRY_DELAYS_MS[0]!);
    expect(fetchUpdateState).toHaveBeenCalledTimes(2);
    expect(getUpdateRunSnapshot().readFailed).toBe(false);

    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(fetchUpdateState).toHaveBeenCalledTimes(2);
    release();
  });

  it("stops when the card leaves, and does not start without one", async () => {
    fetchUpdateState.mockRejectedValue(new TypeError("network"));
    await readUpdateState();
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(fetchUpdateState).toHaveBeenCalledTimes(1);

    const release = holdReadRetry();
    await vi.advanceTimersByTimeAsync(READ_RETRY_DELAYS_MS[0]!);
    expect(fetchUpdateState).toHaveBeenCalledTimes(2);
    release();
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(fetchUpdateState).toHaveBeenCalledTimes(2);
  });

  it("never overlaps: the next wait starts when the slow read has ended", async () => {
    let settle: ((c: UpdateCheckResponse) => void) | undefined;
    fetchUpdateState.mockRejectedValueOnce(new TypeError("network")).mockImplementationOnce(
      () =>
        new Promise<UpdateCheckResponse>((resolve) => {
          settle = resolve;
        }),
    );
    const release = holdReadRetry();
    await readUpdateState();
    await vi.advanceTimersByTimeAsync(READ_RETRY_DELAYS_MS[0]!);
    expect(fetchUpdateState).toHaveBeenCalledTimes(2);

    // The second read is still out, far past the next wait. Nothing else is asked.
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(fetchUpdateState).toHaveBeenCalledTimes(2);
    // A tap on Retry joins it rather than starting a third.
    void retryUpdateRead(true);
    expect(fetchUpdateState).toHaveBeenCalledTimes(2);

    settle?.(answer());
    await vi.advanceTimersByTimeAsync(0);
    expect(getUpdateRunSnapshot().readFailed).toBe(false);
    release();
  });

  it("a manual Retry reads now and starts the schedule over", async () => {
    fetchUpdateState.mockRejectedValue(new TypeError("network"));
    const release = holdReadRetry();
    await readUpdateState();
    // Walk up the schedule to the 15 s wait.
    await vi.advanceTimersByTimeAsync(READ_RETRY_DELAYS_MS[0]!);
    expect(fetchUpdateState).toHaveBeenCalledTimes(2);

    await retryUpdateRead(true);
    expect(fetchUpdateState).toHaveBeenCalledTimes(3);

    // After the manual read the wait is the FIRST one again, not the third.
    await vi.advanceTimersByTimeAsync(READ_RETRY_DELAYS_MS[0]!);
    expect(fetchUpdateState).toHaveBeenCalledTimes(4);
    release();
  });
});
