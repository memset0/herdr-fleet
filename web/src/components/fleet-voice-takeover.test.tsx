import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LevelSource } from "@/lib/audio-meter";
import { fleetSpeechEndpoint } from "@/lib/fleet-voice-finish";
import { createSpeechEndpoint, SILENCE_FINISH_MS } from "@/lib/speech-endpoint";

import { VoiceTakeover } from "./voice-takeover";

// fleet-composer-voice: in a Fleet build a clip ends only when the operator ends it. Upstream's own
// countdown cases (voice-takeover.test.tsx) run without the build statement and stay upstream's.

const SPEECH = 0.12;
const QUIET = 0.003;

function scripted(initial = QUIET) {
  const state = { rms: initial };
  const source: LevelSource = {
    read: (bars) => {
      bars.fill(state.rms > 0.01 ? 0.7 : 0.05);
      return state.rms;
    },
  };
  return { state, source };
}

function renderRecording(source: LevelSource) {
  const onStop = vi.fn();
  const onDiscard = vi.fn();
  const view = render(
    <VoiceTakeover phase="recording" elapsed="0:07" source={source} padClassName="pb-2" onStop={onStop} onDiscard={onDiscard} />,
  );
  const ring = view.container.querySelector('svg[viewBox="-24 -24 48 48"]');
  if (!(ring instanceof SVGSVGElement)) throw new Error("no ring");
  return { onStop, onDiscard, ring, ...view };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("Fleet recorder bar — no finish on silence", () => {
  it("keeps recording through any quiet after speech, with no countdown drawn", () => {
    vi.stubEnv("VITE_HERDR_FLEET", "1");
    const { state, source } = scripted(QUIET);
    const { onStop, ring, container } = renderRecording(source);
    state.rms = SPEECH;
    act(() => vi.advanceTimersByTime(1000));
    expect(container.querySelector("[data-level]")?.getAttribute("data-level")).toBe("speaking");
    state.rms = QUIET;
    act(() => vi.advanceTimersByTime(SILENCE_FINISH_MS * 30));
    // Upstream's reading of the room is kept: the bars say the speaker went quiet.
    expect(container.querySelector("[data-level]")?.getAttribute("data-level")).toBe("quiet");
    expect(ring.style.opacity).toBe("0");
    expect(onStop).not.toHaveBeenCalled();
  });

  it("still finishes on OK, once, after a long pause", () => {
    vi.stubEnv("VITE_HERDR_FLEET", "1");
    const { state, source } = scripted(SPEECH);
    const { onStop, onDiscard } = renderRecording(source);
    act(() => vi.advanceTimersByTime(800));
    state.rms = QUIET;
    act(() => vi.advanceTimersByTime(SILENCE_FINISH_MS * 5));
    fireEvent.click(screen.getByRole("button", { name: /finish and transcribe/i }));
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(onDiscard).not.toHaveBeenCalled();
  });

  it("still discards on the bin", () => {
    vi.stubEnv("VITE_HERDR_FLEET", "1");
    const { source } = scripted(SPEECH);
    const { onStop, onDiscard } = renderRecording(source);
    act(() => vi.advanceTimersByTime(800));
    fireEvent.click(screen.getByRole("button", { name: /discard/i }));
    expect(onDiscard).toHaveBeenCalledTimes(1);
    expect(onStop).not.toHaveBeenCalled();
  });

  it("leaves upstream's detector untouched outside a Fleet build", () => {
    const upstream = createSpeechEndpoint();
    expect(fleetSpeechEndpoint(upstream)).toBe(upstream);
    const { state, source } = scripted(SPEECH);
    const { onStop } = renderRecording(source);
    act(() => vi.advanceTimersByTime(800));
    state.rms = QUIET;
    act(() => vi.advanceTimersByTime(SILENCE_FINISH_MS + 200));
    expect(onStop).toHaveBeenCalledTimes(1);
  });
});
