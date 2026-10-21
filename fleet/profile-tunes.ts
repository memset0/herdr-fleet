// The changes Fleet makes to Collie's harness profiles as they load (`loadProfiles`).
//
// Each tune is a pure function of one parsed profile, so the shipped JSON stays upstream's text.

import type { Profile } from "../web/src/lib/surface/profile.ts";
import { withEnterSubmit } from "./enter-steers.ts";

/**
 * A right-aligned notice under Claude Code's box (fleet-claude-notice-hint): "✔ Update installed ·
 * Restart to update" and its kin sit on a row of their own while the footer's hint row is long (a
 * turn's "esc to interrupt · ← 2 agents"), and join that row once the box holds text and the hint
 * shortens. Measured on Claude Code 2.1.304, 2026-10-21: two rows under the box became one at the
 * probe's character, and every send into a turn failed `probe_failed`. Such a row is a hint, so it is
 * left out of the count of rows under the box; a list or dialog under the box starts at the left.
 */
export const CLAUDE_NOTICE_HINT = "^\\s{20,}[✔✗⚠]\\s\\S.*$";

/** The profiles whose rows under the box may hold {@link CLAUDE_NOTICE_HINT}. */
const NOTICE_PROFILES: ReadonlySet<string> = new Set(["claude"]);

/** The profile with the right-aligned notice row counted as a hint under the box. */
export function withNoticeHint(profile: Profile): Profile {
  if (!NOTICE_PROFILES.has(profile.id)) return profile;
  const below = profile.idle.volatile.below;
  const hints = [...(below.hints ?? []), CLAUDE_NOTICE_HINT];
  return { ...profile, idle: { ...profile.idle, volatile: { ...profile.idle.volatile, below: { ...below, hints } } } };
}

/** Every Fleet tune, applied to one parsed profile. */
export function fleetProfile(profile: Profile): Profile {
  return withNoticeHint(withEnterSubmit(profile));
}
