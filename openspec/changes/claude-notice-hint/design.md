## Decisions

- **A profile hint, not a protocol change.** `countBelow` already leaves out rows matching `idle.volatile.below.hints`; the Claude profile names none. Adding one at load keeps every comparison that reads the count (probe, S1, the queued path) consistent with one change.
- **Shape of the row:** at least 20 leading spaces, then ✔, ✗ or ⚠ and text. A list, dialog or popup under the box starts at the left margin, so it is still counted and still fails the probe; the merged row starts with the hint at the margin and is counted once in both reads.
- **One hook:** `loadProfiles` calls `fleetProfile` from `fleet/profile-tunes.ts`, which applies `withEnterSubmit` and this hint, so later tunes need no new upstream edit.
- **Tests:** a fake Claude pane in a turn with the two-row footer and the merged one-row footer: the send goes in; with the hint removed the same pane fails `probe_failed`, reproducing the production refusal.
