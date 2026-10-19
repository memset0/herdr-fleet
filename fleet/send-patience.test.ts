import { describe, expect, test } from "bun:test";
import { BOUNDS, LOCK_BOUND_MS, POLL_GAP_MAX_MS } from "../bridge/surface/protocol.ts";
import { WRITE_BUDGET_MS } from "../bridge/crew/peer-client.ts";
import { forwardWriteBudget, SEND_FORWARD_BUDGET_MS, SEND_REQUEST_TIMEOUT_MS } from "./send-patience.ts";

describe("send patience", () => {
  test("every step's bound is ended by its time, not its read count, with the gap capped", () => {
    for (const step of [BOUNDS.probe, BOUNDS.s1, BOUNDS.s2, BOUNDS.notice]) {
      expect(step.reads * POLL_GAP_MAX_MS).toBeGreaterThanOrEqual(step.ms);
    }
    expect(POLL_GAP_MAX_MS).toBeLessThanOrEqual(300);
  });

  test("the step bounds are the patient ones, and the lock bound is their sum", () => {
    expect(BOUNDS.probe.ms).toBeGreaterThanOrEqual(8000);
    expect(BOUNDS.s1.ms).toBeGreaterThanOrEqual(15000);
    expect(BOUNDS.s2.ms).toBeGreaterThanOrEqual(15000);
    expect(LOCK_BOUND_MS).toBe(BOUNDS.s0.ms + BOUNDS.probe.ms + BOUNDS.s1.ms + BOUNDS.s2.ms);
  });

  test("the phone outlasts the lead's forward, and the forward outlasts the member's lock", () => {
    expect(SEND_FORWARD_BUDGET_MS).toBeGreaterThan(LOCK_BOUND_MS);
    expect(SEND_REQUEST_TIMEOUT_MS).toBeGreaterThan(SEND_FORWARD_BUDGET_MS);
  });

  test("only a pane's reply route takes the send budget", () => {
    expect(forwardWriteBudget("pane/w1:p1/reply", WRITE_BUDGET_MS)).toBe(SEND_FORWARD_BUDGET_MS);
    for (const route of ["pane/w1:p1/keys", "pane/w1:p1/close", "pane/w1:p1/send", "launch", "tab", "pane/reply"]) {
      expect(forwardWriteBudget(route, WRITE_BUDGET_MS)).toBe(WRITE_BUDGET_MS);
    }
  });
});
