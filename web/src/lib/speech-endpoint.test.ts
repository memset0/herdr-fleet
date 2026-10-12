import { describe, expect, it } from "vitest";

import {
  createSpeechEndpoint,
  MAX_FRAME_GAP_MS,
  NOISE_FLOOR_CEILING,
  SILENCE_FINISH_MS,
  SPEECH_CONFIRM_MS,
  SPEECH_MIN_RMS,
  type EndpointFrame,
} from "./speech-endpoint";

const FRAME_MS = 16;

/** Feed `levels` (one RMS per 16 ms frame) into a detector, continuing a running clock. */
function rig() {
  const endpoint = createSpeechEndpoint();
  let now = 1000;
  const frames: EndpointFrame[] = [];
  return {
    frames,
    /** `ms` of a steady level. */
    feed(ms: number, level: number): EndpointFrame {
      return this.feedWith(ms, () => level);
    },
    /** `ms` of whatever `level(t)` returns, `t` being ms since this call began. */
    feedWith(ms: number, level: (tMs: number) => number): EndpointFrame {
      const end = now + ms;
      const start = now;
      let last: EndpointFrame | undefined;
      while (now < end) {
        const rms = level(now - start);
        last = endpoint.next(rms, now);
        frames.push(last);
        now += FRAME_MS;
      }
      if (last === undefined) throw new Error("fed no frames");
      return last;
    },
    get finishes(): number {
      return frames.filter((f) => f.finish).length;
    },
  };
}

const QUIET = 0.004;
const SPEECH = 0.12;

describe("the speech endpoint — silence only", () => {
  it("never hears speech and never finishes, however long the room stays quiet", () => {
    const r = rig();
    const last = r.feed(60_000, QUIET);
    expect(last.heard).toBe(false);
    expect(last.progress).toBe(0);
    expect(r.finishes).toBe(0);
  });

  it("does not count a quiet room's breathing under the absolute minimum as speech", () => {
    const r = rig();
    const last = r.feed(10_000, SPEECH_MIN_RMS * 0.9);
    expect(last.speaking).toBe(false);
    expect(last.heard).toBe(false);
  });
});

describe("the speech endpoint — speech, then silence", () => {
  it("finishes once, SILENCE_FINISH_MS after the last speech", () => {
    const r = rig();
    r.feed(500, QUIET);
    r.feed(1500, SPEECH);
    expect(r.frames.at(-1)?.heard).toBe(true);
    const quietStart = r.frames.length;
    r.feed(SILENCE_FINISH_MS + 500, QUIET);
    const finishIndex = r.frames.findIndex((f) => f.finish);
    expect(finishIndex).toBeGreaterThan(quietStart);
    const waited = (finishIndex - quietStart) * FRAME_MS;
    expect(waited).toBeGreaterThanOrEqual(SILENCE_FINISH_MS - FRAME_MS);
    expect(waited).toBeLessThanOrEqual(SILENCE_FINISH_MS + FRAME_MS * 2);
    // A latched edge: the caller can stop only once.
    expect(r.finishes).toBe(1);
  });

  it("closes the ring in step with the quiet: 0 at the start, half way at half the wait, full at the end", () => {
    const r = rig();
    r.feed(1000, SPEECH);
    const first = r.feed(FRAME_MS, QUIET);
    expect(first.progress).toBe(0);
    const half = r.feed(SILENCE_FINISH_MS / 2, QUIET);
    expect(half.progress).toBeGreaterThan(0.45);
    expect(half.progress).toBeLessThan(0.55);
    const end = r.feed(SILENCE_FINISH_MS / 2 + FRAME_MS, QUIET);
    expect(end.progress).toBe(1);
  });

  it("starts the clock only after speech: a clip that opens with 10 s of quiet then speaks still gets its full countdown", () => {
    const r = rig();
    r.feed(10_000, QUIET);
    expect(r.finishes).toBe(0);
    r.feed(800, SPEECH);
    r.feed(SILENCE_FINISH_MS - 200, QUIET);
    expect(r.finishes).toBe(0);
    r.feed(400, QUIET);
    expect(r.finishes).toBe(1);
  });

  it("hears speech from the very first frame", () => {
    const r = rig();
    r.feed(600, SPEECH);
    expect(r.frames.at(-1)?.heard).toBe(true);
    r.feed(SILENCE_FINISH_MS + 200, QUIET);
    expect(r.finishes).toBe(1);
  });
});

describe("the speech endpoint — speech, a pause, speech", () => {
  it("resets the countdown when speech resumes inside the countdown", () => {
    const r = rig();
    r.feed(500, QUIET);
    r.feed(1000, SPEECH);
    r.feed(SILENCE_FINISH_MS * 0.9, QUIET);
    expect(r.frames.at(-1)?.progress).toBeGreaterThan(0.8);
    const resumed = r.feed(300, SPEECH);
    expect(resumed.progress).toBe(0);
    expect(resumed.silentMs).toBe(0);
    // A pause that would have ended the first countdown no longer does: the countdown starts over.
    r.feed(SILENCE_FINISH_MS * 0.9, QUIET);
    expect(r.finishes).toBe(0);
    r.feed(SILENCE_FINISH_MS * 0.2, QUIET);
    expect(r.finishes).toBe(1);
  });

  it("a single loud frame inside the quiet resets it (continuously below, or no finish)", () => {
    const r = rig();
    r.feed(1000, SPEECH);
    r.feed(SILENCE_FINISH_MS - 100, QUIET);
    r.feed(FRAME_MS, SPEECH);
    r.feed(SILENCE_FINISH_MS - 100, QUIET);
    expect(r.finishes).toBe(0);
    r.feed(300, QUIET);
    expect(r.finishes).toBe(1);
  });
});

describe("the speech endpoint — the noise floor", () => {
  it("steady room noise above the absolute minimum is not speech once the floor has seen it", () => {
    const r = rig();
    const last = r.feed(20_000, 0.02);
    expect(last.heard).toBe(false);
    expect(last.floor).toBeCloseTo(0.02, 3);
    expect(r.finishes).toBe(0);
  });

  it("hears a voice over that noise, and finishes when the voice stops but the noise stays", () => {
    const r = rig();
    r.feed(2000, 0.02);
    const voice = r.feed(1500, 0.2);
    expect(voice.heard).toBe(true);
    r.feed(SILENCE_FINISH_MS + 300, 0.02);
    expect(r.finishes).toBe(1);
  });

  it("follows a floor that rises slowly, so a fan switching on is not mistaken for speech for ever", () => {
    const r = rig();
    r.feed(2000, 0.003);
    // Noise steps up to 0.025, which is over 3x the old floor and over the minimum: speech to start with.
    const step = r.feed(FRAME_MS * 20, 0.025);
    expect(step.speaking).toBe(true);
    // The floor never climbs past the ceiling, so a noisy room still leaves a normal voice audible.
    const later = r.feed(60_000, 0.025);
    expect(later.floor).toBeLessThanOrEqual(NOISE_FLOOR_CEILING);
  });

  it("does not let a long monologue drag the floor up to the voice", () => {
    const r = rig();
    r.feed(1000, QUIET);
    // 30 s of speech with a small dip every second, as words have.
    const last = r.feedWith(30_000, (t) => (t % 1000 < 80 ? 0.01 : 0.12));
    expect(last.floor).toBeLessThan(0.02);
    expect(r.finishes).toBe(0);
    expect(r.frames.filter((f) => f.silentMs > 0).length).toBeLessThan(5 * 80);
  });

  it("a loud first reading cannot blind it: the floor is capped at the ceiling", () => {
    const r = rig();
    const first = r.feed(FRAME_MS, 0.5);
    expect(first.floor).toBe(NOISE_FLOOR_CEILING);
    expect(first.threshold).toBeCloseTo(NOISE_FLOOR_CEILING * 3, 6);
  });

  it("a click shorter than SPEECH_CONFIRM_MS does not count as having heard speech", () => {
    const r = rig();
    r.feed(500, QUIET);
    r.feed(SPEECH_CONFIRM_MS - FRAME_MS * 2, 0.3);
    r.feed(5000, QUIET);
    expect(r.frames.at(-1)?.heard).toBe(false);
    expect(r.finishes).toBe(0);
  });

  it("a throttled frame gap does not lift the floor by more than a capped step", () => {
    const endpoint = createSpeechEndpoint();
    endpoint.next(0.002, 0);
    const after = endpoint.next(0.01, 600_000);
    // 600 s gap, capped at MAX_FRAME_GAP_MS: the floor rose by well under 2%.
    expect(after.floor).toBeLessThan(0.002 * (1 + 0.05 * (MAX_FRAME_GAP_MS / 1000)) + 1e-9);
  });
});
