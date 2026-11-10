// The model picker case never presses Enter after a refused shortcut (picker-open.ts, M80 spec 08).
import { describe, expect, it } from "vitest";

import type { Answer, TapLog } from "./leg";
import { probeRefused, sendRefusal } from "./picker-open";

const answer = (path: string, outcome: string | null, reason: string | null): Answer => ({ at: 0, path, status: 200, outcome, reason, detail: null, requestId: null, receipt: "{}" });
const tapOf = (...answers: Answer[]): TapLog => ({ label: "Model shortcut", at: "2026-10-31T11:54:06.156Z", answers, worked: false, screenStillMs: null });

describe("the Model shortcut's answer", () => {
  it("reads the leg's red of 2026-10-31 as probe_failed: nothing was typed", () => {
    const log = tapOf(answer("/api/send", "refused", "probe_failed"));
    expect(sendRefusal(log)).toBe("probe_failed");
    expect(probeRefused(log)).toBe(true);
  });

  it("reads a typed, not submitted shortcut as no refusal: its text is in the box, so Submit or Enter may follow", () => {
    expect(sendRefusal(tapOf(answer("/api/send", "typed_not_submitted", "no_evidence")))).toBeNull();
    expect(probeRefused(tapOf(answer("/api/send", "sent", null)))).toBe(false);
  });

  it("names any other refusal too, and ignores answers that are not sends", () => {
    expect(sendRefusal(tapOf(answer("/api/send", "refused", "not_free")))).toBe("not_free");
    expect(sendRefusal(tapOf(answer("/api/pane/w4:p1/keys", "refused", "probe_failed")))).toBeNull();
    expect(sendRefusal(tapOf())).toBeNull();
  });
});
