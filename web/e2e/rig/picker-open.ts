// How the pi and omp model picker case reads the answer to its Model shortcut (others.spec.ts
// `pickerByKeys`, M80 spec 08). A refused send typed nothing: Enter after it would submit whatever the
// box shows later. On 2026-10-31 omp drew the probe character of a refused `/model` late, the case's
// fallback pressed Enter on it, and omp made a model call the replay has no cassette for, so the row
// read as a cassette mismatch instead of the refusal it was.

import type { TapLog } from "./leg";

/** The reason of a send this tap made that the bridge refused (nothing was typed), else null. */
export function sendRefusal(log: TapLog): string | null {
  const refused = log.answers.find((answer) => answer.path.startsWith("/api/send") && answer.outcome === "refused");
  return refused === undefined ? null : (refused.reason ?? "no reason");
}

/** The tap's send was refused `probe_failed`: the probe character did not show in the box. */
export function probeRefused(log: TapLog): boolean {
  return sendRefusal(log) === "probe_failed";
}
