import { isFleetBuild } from "@/lib/fleet-build";
import type { SpeechEndpoint } from "@/lib/speech-endpoint";

// A CLIP ENDS WHEN THE OPERATOR ENDS IT (fleet-composer-voice).
//
// Collie 1.20's recorder bar (components/voice-takeover.tsx) feeds every level reading to a speech
// detector (lib/speech-endpoint.ts) and, two seconds after speech goes quiet, closes a ring round OK
// and finishes the clip by calling the same stop OK calls. Herdr Fleet does not: dictation here is
// done in turns, with pauses to think, and a pause that sends half a sentence for transcription is
// the failure this module removes. The owner decided it, and there is no setting.
//
// THE DECISION IS MADE ON THE DETECTOR, NOT ON THE CALLBACK, because the ring is drawn from the
// detector's `progress` and the finish is its `finish`: muting the callback alone would still close
// the ring round OK and then do nothing. So in a Fleet build the frames keep everything upstream
// measured — whether the speaker is talking, whether speech was heard, the floor, the threshold and
// the quiet so far — and report no countdown and no finish. The level display and its speaking/quiet
// ink stay upstream's; OK, the bin, Escape and the recorder's own cap still end a clip.
//
// A bundle built without the Fleet statement gets upstream's detector back unchanged, so Collie's own
// suites and browser tier keep their countdown cases. The one upstream line that calls this is in
// hooks/use-voice-levels.ts (FORK.toml composer-voice-rank-port).

export function fleetSpeechEndpoint(endpoint: SpeechEndpoint): SpeechEndpoint {
  if (!isFleetBuild()) return endpoint;
  return {
    next: (rms, nowMs) => ({ ...endpoint.next(rms, nowMs), progress: 0, finish: false }),
  };
}
