// Fleet sends a text to Codex with Enter, on an idle box and into a running turn (fleet-enter-steers).
//
// Collie v1.22.6 gives the Codex profile Tab as its submit key: Tab sends on an idle box and queues
// the text behind a running turn, and the Send Protocol never presses Enter into that turn, because
// Codex's Enter steers it. The operator wants the steer: the text joins the turn now, as typing Enter
// at the desk does, and shows in the conversation at once instead of waiting in Codex's queue. So the
// profile's submit key is Enter here, and the protocol presses it on the in-turn path too. A command
// in a turn keeps the queue key; a receipt says `queued` only when Codex's own queued row shows the text.

import type { Profile } from "../web/src/lib/surface/profile.ts";

/** The profiles whose texts go in with Enter, which steers their running turn. */
export const ENTER_STEERS_PROFILES: ReadonlySet<string> = new Set(["codex"]);

/** The profile with Enter as its submit key on every platform, when it is one of {@link ENTER_STEERS_PROFILES} and its Enter steers. */
export function withEnterSubmit(profile: Profile): Profile {
  if (!ENTER_STEERS_PROFILES.has(profile.id) || profile.keys.enterWhileRunning !== "steers") return profile;
  const { submitByPlatform: _platforms, ...keys } = profile.keys;
  return { ...profile, keys: { ...keys, submit: ["Enter"] } };
}

/** Whether a text into a running turn goes in with the submit keys: they are Enter, and Enter steers. */
export function steersWithEnter(keys: Profile["keys"]): boolean {
  return keys.enterWhileRunning === "steers" && keys.submit.includes("Enter");
}
