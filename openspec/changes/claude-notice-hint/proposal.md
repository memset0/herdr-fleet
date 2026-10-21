## Why

Every send into a running Claude Code turn failed `probe_failed` ("The probe character changed more than the box") on panes showing Claude's right-aligned "✔ Update installed · Restart to update" notice. Measured on Claude Code 2.1.304: in a turn the footer's hint row is long ("… · esc to interrupt · ← 2 agents") and the notice sits on its own row; once the box holds a character the hint shortens and the notice joins it, so the rows under the box go from two to one. Collie's probe requires that count to stay.

## What Changes

- Fleet adds a hint to the Claude profile as it loads: a row of only a right-aligned notice (at least 20 leading spaces, then ✔, ✗ or ⚠) is left out of the count of rows under the box, as profile hints already are.
- The profile tunes move behind one owned function, `fleetProfile`, which `loadProfiles` calls.

## Capabilities

### New Capabilities
- `fleet-claude-notice-hint`: Claude's right-aligned notice rows do not count as rows under the box.

### Modified Capabilities
None.

## Impact

Baseline Collie v1.22.6. Upstream-owned: `web/src/lib/surface/profile.ts` (the call becomes `fleetProfile`) and `bridge/surface/protocol.test.ts` (Fleet's cases). Fork-owned: `fleet/profile-tunes.ts`. The profile is read by the bridge, so this is a MINOR release.
