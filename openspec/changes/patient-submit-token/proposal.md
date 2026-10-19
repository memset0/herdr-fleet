## Why

The Send Protocol's commit mints a key token, records `submit-sent` on disk, then presses the submit key through the gate. Collie v1.22.6 lets the token live 150 ms (`TOKEN_LIFETIME_MS`). Where the state directory sits on a network filesystem, the record write alone (an existence check, a read, a write, a chmod and a rename) can take longer than that, so the gate refuses the token as stale and the person reads "Your text is in the box, but Enter was not pressed" over a send that S1 had already verified.

## What Changes

- Lengthen the key token's lifetime to a few seconds, as a plain constant owned by the fork, so a slow record write no longer spends it.
- Keep everything else of the gate: a token is still spent by its first commit, still refused when the pane's gate revision moved after its read (a person's key, a protocol write), and still never carries Escape.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `fleet-send-patience`: adds the key token's lifetime.

## Impact

Baseline Collie v1.22.6. Upstream-owned paths: `bridge/surface/key-gate.ts` (the lifetime constant) and the one `protocol.test.ts` case that ages a token past it by a literal 151 ms. Fork-owned: `fleet/send-patience.ts` gains the constant. The gate runs in the bridge on every member, so this is a MINOR release.

Non-goals: no reordering of the commit (the `submit-sent` record stays on disk before the key, and the token stays minted on S1's revision), no change to the Send Protocol bounds or to the ask answerer beyond sharing the lifetime. Cost accepted: the time between S1's verdict and the submit key may now grow to the new lifetime on a slow disk; the revision check and S2's dialog check still apply.
