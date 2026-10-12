import { useCallback, useEffect, useRef } from "react";

import type { LevelSource } from "@/lib/audio-meter";
import { createSpeechEndpoint } from "@/lib/speech-endpoint";
import { BAR_REST } from "@/lib/voice-levels";

// THE VOICE TAKEOVER'S PER-FRAME LOOP. It reads the level source once per animation frame, feeds the
// loudness to the speech detector (lib/speech-endpoint.ts), and writes the result straight onto the
// elements: `transform: scaleY()` on each bar, `stroke-dashoffset` on the countdown ring, a
// `data-level` word on the equalizer. None of it goes through React state, so a moving level costs
// no render and no layout (DESIGN.md §2): the bars are reserved slots that scale inside themselves.
//
// REDUCED MOTION. Under `prefers-reduced-motion` the bars do not move with the voice. They sit at a
// fixed fill that changes only when speech starts or stops (the ink changes with it), and the ring
// advances in whole thirds of the countdown instead of continuously. The detector still runs, so
// auto-finish works the same.

/** How full a bar stands under reduced motion while the speaker is talking. */
const STILL_SPEAKING_SCALE = 0.45;

/** The three states `data-level` can name; the bars' ink hangs off it. */
export type LevelWord = "idle" | "speaking" | "quiet";

export interface VoiceLevelsOptions {
  /** Where the audio comes from. `null` draws resting bars and never auto-finishes. */
  source: LevelSource | null;
  /**
   * `live` while the clip records (the loop runs); `rest` while the permission prompt is up (flat
   * bars); `frozen` while transcribing (the last frame stays, or a speech-shaped row if none was drawn).
   */
  mode: "rest" | "live" | "frozen";
  /** The bar count; the same number the markup renders. */
  count: number;
  reduced: boolean;
  /** The silence countdown ran out. Called once. */
  onFinish: () => void;
}

export interface VoiceLevels {
  /** Ref callback for bar `i`. */
  barRef: (i: number) => (el: HTMLElement | null) => void;
  /** Ref for the equalizer's root, which carries `data-level`. */
  levelRef: (el: HTMLElement | null) => void;
  /** Ref for the countdown ring's `<svg>`; its LAST child is the progress circle. */
  ringRef: (el: SVGSVGElement | null) => void;
}

/** A frozen speech-shaped row, for the transcribing state when no frame was ever painted. */
function frozenPattern(i: number): number {
  return 0.14 + 0.6 * Math.abs(Math.sin(i * 0.55));
}

export function useVoiceLevels({ source, mode, count, reduced, onFinish }: VoiceLevelsOptions): VoiceLevels {
  const bars = useRef<(HTMLElement | null)[]>([]);
  const level = useRef<HTMLElement | null>(null);
  const ring = useRef<SVGSVGElement | null>(null);
  const painted = useRef(false);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  useEffect(() => {
    const paintBar = (i: number, scale: number) => {
      const el = bars.current[i];
      if (el) el.style.transform = `scaleY(${scale.toFixed(3)})`;
    };
    if (mode === "frozen") {
      // The clip is over: the bars stay as its last frame. With no frame ever drawn (the
      // playground's card), a speech-shaped row beats a flat one.
      if (!painted.current) {
        for (let i = 0; i < count; i += 1) paintBar(i, frozenPattern(i));
        painted.current = true;
      }
      return;
    }
    if (mode === "rest") {
      for (let i = 0; i < count; i += 1) paintBar(i, BAR_REST);
      return;
    }
    for (let i = 0; i < count; i += 1) paintBar(i, BAR_REST);
    painted.current = true;
    if (source === null) return;

    const endpoint = createSpeechEndpoint();
    const heights = new Float32Array(count);
    let word: LevelWord | null = null;
    let lastRing = -1;
    let raf = 0;
    let done = false;

    const frame = (now: number) => {
      if (done) return;
      const rms = source.read(heights);
      const result = endpoint.next(rms, now);

      const nextWord: LevelWord = result.speaking ? "speaking" : result.heard ? "quiet" : "idle";
      if (nextWord !== word) {
        word = nextWord;
        if (level.current) level.current.dataset.level = nextWord;
        if (reduced) {
          const scale = nextWord === "speaking" ? STILL_SPEAKING_SCALE : BAR_REST;
          for (let i = 0; i < count; i += 1) paintBar(i, scale);
        }
      }
      if (!reduced) {
        for (let i = 0; i < count; i += 1) paintBar(i, Math.max(BAR_REST, heights[i] ?? 0));
      }

      // The ring: empty and invisible until the countdown starts, closing over the endpoint's SILENCE_FINISH_MS, whole thirds when reduced.
      const progress = reduced ? Math.floor(result.progress * 3) / 3 : result.progress;
      if (progress !== lastRing) {
        lastRing = progress;
        const svg = ring.current;
        const arc = svg?.lastElementChild;
        if (svg && arc instanceof SVGElement) {
          svg.style.opacity = progress > 0 ? "1" : "0";
          arc.style.strokeDashoffset = String(100 - 100 * progress);
        }
      }

      if (result.finish) {
        done = true;
        onFinishRef.current();
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      done = true;
      cancelAnimationFrame(raf);
    };
  }, [source, mode, count, reduced]);

  const barRef = useCallback(
    (i: number) => (el: HTMLElement | null) => {
      bars.current[i] = el;
    },
    [],
  );
  const levelRef = useCallback((el: HTMLElement | null) => {
    level.current = el;
  }, []);
  const ringRef = useCallback((el: SVGSVGElement | null) => {
    ring.current = el;
  }, []);
  return { barRef, levelRef, ringRef };
}
