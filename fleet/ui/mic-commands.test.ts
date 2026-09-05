import { describe, expect, test } from "bun:test";

import { decideMicCommand, type MicConditions, type MicPhase } from "./mic-commands.ts";

function conditions(overrides: Partial<MicConditions> = {}): MicConditions {
  return {
    available: true,
    locked: false,
    directTyping: false,
    sending: false,
    phase: "idle",
    ...overrides,
  };
}

describe("what a microphone command does when it can", () => {
  test("start records, stop sends, and toggle is whichever the phase calls for", () => {
    expect(decideMicCommand("start", conditions())).toEqual({ kind: "start" });
    expect(decideMicCommand("stop", conditions({ phase: "recording" }))).toEqual({ kind: "stop" });
    expect(decideMicCommand("toggle", conditions())).toEqual({ kind: "start" });
    expect(decideMicCommand("toggle", conditions({ phase: "recording" }))).toEqual({ kind: "stop" });
  });
});

describe("when it refuses", () => {
  test("starting something already started, and stopping something not started", () => {
    expect(decideMicCommand("start", conditions({ phase: "recording" }))).toEqual({
      kind: "refuse",
      refusal: "already-recording",
    });
    expect(decideMicCommand("stop", conditions())).toEqual({ kind: "refuse", refusal: "not-recording" });
  });

  test("a clip still being transcribed refuses all three, the toggle included", () => {
    // The toggle does not quietly pick whichever half is legal: neither is. Starting would abandon a
    // transcript the operator is still owed, and there is nothing to stop.
    for (const command of ["start", "stop", "toggle"] as const) {
      expect(decideMicCommand(command, conditions({ phase: "transcribing" }))).toEqual({
        kind: "refuse",
        refusal: "transcribing",
      });
    }
  });

  test("every condition that greys the button out is a sentence here", () => {
    expect(decideMicCommand("toggle", conditions({ available: false }))).toEqual({
      kind: "refuse",
      refusal: "absent",
    });
    expect(decideMicCommand("toggle", conditions({ locked: true }))).toEqual({
      kind: "refuse",
      refusal: "locked",
    });
    expect(decideMicCommand("toggle", conditions({ directTyping: true }))).toEqual({
      kind: "refuse",
      refusal: "direct",
    });
    expect(decideMicCommand("toggle", conditions({ sending: true }))).toEqual({
      kind: "refuse",
      refusal: "sending",
    });
  });

  test("the feature being absent is reported ahead of anything about this moment", () => {
    // Being told "already recording" when there is no microphone would send the operator looking in
    // the wrong place entirely.
    expect(
      decideMicCommand("start", conditions({ available: false, phase: "recording", locked: true })),
    ).toEqual({ kind: "refuse", refusal: "absent" });
  });

  test("a request still being granted is not yet a recording", () => {
    // `requesting` is the permission prompt. Starting again is refused as already-recording only
    // once the recorder actually is; until then the honest answer is that a start is what happens.
    const phase: MicPhase = "requesting";
    expect(decideMicCommand("start", conditions({ phase }))).toEqual({ kind: "start" });
    expect(decideMicCommand("stop", conditions({ phase }))).toEqual({
      kind: "refuse",
      refusal: "not-recording",
    });
  });
});
