## Why

Collie v1.22.6 sends a Codex text with Tab: Tab sends on an idle box and, during a turn, puts the text in Codex's queue, where it waits for the turn to end. The Send Protocol never presses Enter into a Codex turn, because Codex's Enter steers the running turn. The operator wants the steer, as typing Enter at the desk gives: the text joins the turn at once. A queued text also stays out of the conversation the Chat view reads until Codex takes it, so the person cannot see what they sent.

## What Changes

- Fleet loads the Codex profile with Enter as its submit key, on every platform; its queue key (Tab) stays.
- On the Send Protocol's in-turn path, a text on a profile whose submit key is the Enter that steers goes in with Enter. The probe, S1 and S2 checks are unchanged: S2 still needs the box to empty.
- A command in a turn keeps the queue key. The receipt says `queued` only when Codex's own queued row shows the text, as before for Codex.

## Capabilities

### New Capabilities
- `fleet-enter-steers`: which harnesses take a text with Enter, idle or in a turn, and what the receipt says.

### Modified Capabilities
None.

## Impact

Baseline Collie v1.22.6. Upstream-owned paths: `web/src/lib/surface/profile.ts` (one import, one call in `loadProfiles`), `bridge/surface/protocol.ts` (one import, one line in `commitKeys`) and `bridge/surface/protocol.test.ts` (the Codex cases pin Collie's Tab profile through an edit; case K8 is restated; Fleet's cases are added). Fork-owned: `fleet/enter-steers.ts`. The bridge changes, so this is a MINOR release.

Departs from Collie's 2026-10-17 decision that Enter never goes into a running Codex turn. Cost accepted: an Enter that lands as a dialog draws answers it, which the queue key risked the same way; S2's dialog check still reports it.
