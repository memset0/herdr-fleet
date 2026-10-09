import { expect, test, vi } from "bun:test";
import { createSttDeadline, SttCancelledError, SttError } from "../bridge/stt/provider.ts";

// THE RUNTIME FLOOR IS WHAT KEEPS A SPEECH DEADLINE ARMED (fleet-stt-deadline-compat). On Bun 1.3.14
// a direct timeout signal stopped firing once its last abort listener was removed, and sequential
// waits remove theirs between phases; a fork helper re-subscribed it. From Bun 1.4.0 the runtime
// keeps it armed, upstream's own `createSttDeadline` runs unmodified, and these cases are what say so
// on whatever runtime the suite runs on.

test("a timeout remains armed across a gap with no wait listeners", () => {
  vi.useFakeTimers();
  try {
    const signal = AbortSignal.timeout(20);
    const first = () => undefined;
    signal.addEventListener("abort", first);
    signal.removeEventListener("abort", first);
    const reasons: string[] = [];
    signal.addEventListener("abort", () => { reasons.push(signal.reason.name); });
    vi.advanceTimersByTime(20);
    expect(signal.aborted).toBe(true);
    expect(reasons).toEqual(["TimeoutError"]);
  } finally { vi.useRealTimers(); }
});

test("completed phases do not disarm a later stalled wait", async () => {
  const deadline = createSttDeadline(undefined, 10);
  await deadline.wait(Promise.resolve("token"));
  await deadline.wait(Promise.resolve("response"));
  await expect(deadline.wait(new Promise<void>(() => {}))).rejects.toBeInstanceOf(SttError);
  expect(deadline.signal.aborted).toBe(true);
});

test("caller cancellation still wins before the deadline", async () => {
  const caller = new AbortController();
  const deadline = createSttDeadline(caller.signal, 1000);
  caller.abort();
  await expect(deadline.wait(Promise.resolve())).rejects.toBeInstanceOf(SttCancelledError);
});
