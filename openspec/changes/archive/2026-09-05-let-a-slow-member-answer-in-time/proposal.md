## Why

The pack's per-peer probe budget is 1200 ms — 80% of the lead's 1500 ms poll — and it is not
configurable from Fleet. That arithmetic is upstream's, deliberate, and unchanged in its latest
release: a peer that cannot answer inside the budget is reported as an unreachable poll rather than a
slow one, so a slow peer can never stall the lead's own snapshot.

It is the right trade for the topology upstream designed for, and the wrong one for this fleet.
Measured on the live pack, one cold exchange through a member's link costs 0.64–1.51 s end to end, of
which the TLS handshake alone is 0.37–1.00 s. The budget is exceeded whenever a pooled connection has
dropped and the next sweep pays a full handshake. Over 45 samples one member was reported unreachable
4 times and carried the lead's own `slow link` note 11 times, with its receipt reaching 35 s stale.

Two things follow. The budget must be settable for a fleet whose members are a WAN away, and the rail
must stop turning a member it has never heard from into a refusal.

## What Changes

- Add a `[pack]` section to the private configuration carrying the lead's poll interval and per-peer
  budget, validated like every other field and passed to Collie as the environment it already reads.
  Nothing new is invented: these are upstream's own knobs, which this deployment had no way to set.
- Fix the rail's corroboration rule for a member that has never been heard from. `lastSeenAt` of zero
  means "never", not "long ago", and subtracting it produced an age no threshold could survive — so a
  member enrolled a moment ago, or one whose lead has just restarted, was called refused on its first
  sweep with none of the corroboration the rule exists to require.
- Say in the rail when the lead's own answer is "slow", not "refused". The lead already distinguishes
  them and states it in words; only the rail collapsed the two.

Non-goals:

- Changing upstream's budget arithmetic or its clamp. The ceiling stays `poll × 0.8`; this change
  moves the inputs, and a fleet that wants a longer budget raises the poll interval with it.
- Any change to what admits a member. Reachability remains transport only.

## Capabilities

### Modified Capabilities

- `fleet-runtime-configuration`: the private configuration carries the lead's pack timing, and the
  rail distinguishes a member it has never heard from, one answering slowly, and one refusing.

## Impact

- Adds one optional configuration section and two environment variables to Collie's child
  environment. Existing configurations keep working untouched, and a peer's configuration is
  unaffected.
