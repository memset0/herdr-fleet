// WHEN HAS THE SPEAKER FINISHED? A pure detector, no DOM, no clock of its own (voice takeover).
//
// Fed one loudness reading per animation frame (`next(rms, nowMs)`), it answers three questions: is
// there speech right now, has there been any at all, and how long has it been quiet since. The
// takeover (components/voice-takeover.tsx) draws the answer as a ring closing round the OK button and
// calls the recorder's own stop-and-transcribe when it runs out.
//
// THE ONE RULE THAT MATTERS: THE COUNTDOWN STARTS ONLY AFTER SPEECH WAS HEARD. A phone held up in a
// quiet room and a phone held up before the first word look the same to a loudness meter, and
// ending a clip that never contained a word would hand the provider silence to transcribe. So
// before any speech there is no auto-finish at all; the recorder's own hard cap and the OK button
// are the only exits. After speech, `SILENCE_FINISH_MS` of continuous quiet ends the clip, and any
// speech in that stretch starts the count again from nothing.
//
// SPEECH IS RELATIVE TO THE ROOM. A fixed loudness threshold is wrong in both directions: a fan
// would sit above it for ever and a whisper would never reach it. So the detector tracks a noise
// floor, the quietest recent reading, and calls anything well above that floor speech. The floor
// drops at once to a quieter reading and climbs only slowly, so a speaker talking for half a minute
// does not drag the floor up to their own voice, and a room that gets noisier is still followed.
//
// The numbers are a first pass that nobody has tuned against a real microphone yet; each one is a
// named export so the tuning is one line and the tests can read the same values.

/** Quiet this long, continuously, after speech ends the clip. The operator's own number (design 3.3, cut from 3 s on 2026-10-11 after a Pixel test). The ring, the takeover's comments and the tests all derive from this one. */
export const SILENCE_FINISH_MS = 2000;

/** Speech is a reading above this many times the noise floor: 3x is clear of room hiss and under a normal voice. */
export const SPEECH_FLOOR_MULTIPLIER = 3;

/** The lowest RMS (0 to 1) that can be speech, so a digitally quiet mic with a floor near zero does not call a breath speech. */
export const SPEECH_MIN_RMS = 0.015;

/** How fast the floor may climb, as a fraction per second: slow enough that talking cannot lift it to the voice. */
export const NOISE_FLOOR_RISE_PER_S = 0.05;

/** The floor never counts above this, so a loud first reading cannot blind the detector to a normal voice. */
export const NOISE_FLOOR_CEILING = 0.03;

/** The floor never counts below this, so a floor of exact zero (a muted mic) can still climb. */
export const NOISE_FLOOR_MIN = 0.001;

/** A reading must stay above the threshold this long to count as the first speech: a door click is not a word. */
export const SPEECH_CONFIRM_MS = 120;

/** A gap between readings longer than this is a throttled frame, not a quiet room: the floor's climb is capped to it. */
export const MAX_FRAME_GAP_MS = 250;

/** What one reading said. */
export interface EndpointFrame {
  /** This reading is above the speech threshold. */
  speaking: boolean;
  /** Speech has been confirmed at some point in this clip. Latched: it never goes back. */
  heard: boolean;
  /** The noise floor the threshold was built from. */
  floor: number;
  /** The loudness a reading had to exceed to count as speech. */
  threshold: number;
  /** Continuous quiet since the last speech, in ms; 0 before any speech and while speaking. */
  silentMs: number;
  /** `silentMs` as a fraction of {@link SILENCE_FINISH_MS}, 0 to 1: the ring's fill. */
  progress: number;
  /** True on ONE frame only: the one where the silence reached the limit. Latched after, so a caller cannot stop twice. */
  finish: boolean;
}

/** One clip's detector. Make a new one per clip. */
export interface SpeechEndpoint {
  next: (rms: number, nowMs: number) => EndpointFrame;
}

export function createSpeechEndpoint(): SpeechEndpoint {
  let floor: number | null = null;
  let lastAt: number | null = null;
  let loudSince: number | null = null;
  let quietSince: number | null = null;
  let heard = false;
  let finished = false;

  function next(rms: number, nowMs: number): EndpointFrame {
    const gapS = lastAt === null ? 0 : Math.min(nowMs - lastAt, MAX_FRAME_GAP_MS) / 1000;
    lastAt = nowMs;

    // The floor: the quietest reading so far, seeded by the first, climbing slowly otherwise.
    const reading = Math.max(NOISE_FLOOR_MIN, rms);
    if (floor === null) floor = Math.min(reading, NOISE_FLOOR_CEILING);
    else if (reading < floor) floor = reading;
    else floor = Math.min(NOISE_FLOOR_CEILING, floor * (1 + NOISE_FLOOR_RISE_PER_S * gapS));

    const threshold = Math.max(floor * SPEECH_FLOOR_MULTIPLIER, SPEECH_MIN_RMS);
    const speaking = rms > threshold;

    if (speaking) {
      loudSince ??= nowMs;
      if (nowMs - loudSince >= SPEECH_CONFIRM_MS) heard = true;
      quietSince = null;
    } else {
      loudSince = null;
      if (heard) quietSince ??= nowMs;
    }

    const silentMs = heard && quietSince !== null ? nowMs - quietSince : 0;
    const finish = !finished && silentMs >= SILENCE_FINISH_MS;
    if (finish) finished = true;
    return {
      speaking,
      heard,
      floor,
      threshold,
      silentMs,
      progress: Math.min(1, silentMs / SILENCE_FINISH_MS),
      finish,
    };
  }

  return { next };
}
