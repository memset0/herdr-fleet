## Why

Collie 1.9 and later read only the `crew` key of a trust store. A store still in the pre-1.9 inner
shape (`pack` / `packId`) — which a peer can carry because a peer never commits a trust change under
the 1.8 overlap — parses as a valid store with no crew. On the 3.5.0 adoption a member started in
that state, derived native Peer mode from its lead record, passed Fleet's authority check, and then
refused its own lead as unauthorized because it held no crew secret. Fleet should say what it found
and start nothing, instead of letting the member run with a trust store it cannot use.

## What Changes

- Baseline: Collie `v1.14.2`, as recorded in `UPSTREAM.md`; this change adopts nothing.
- Fleet's start-time authority validation (daemon and control paths alike) reads the raw trust-store
  document before Collie's reader runs. A document whose top level has a `pack` key and no `crew` key
  fails startup with a notice that names the file, names the keys, and says the store must first be
  rewritten by the member's previous Fleet release (3.4.x) with its own trust-store no-op commit. The
  notice carries key names only, never values. Nothing is written.
- Fleet's operator-invoked enrolment commands (`pack-invite` and `pack-join`) apply the same refusal
  before opening the store, so an enrolment can never rewrite a pack-shaped store and drop its crew.
- A store with a `crew` key proceeds exactly as today, including one that also carries a stray
  `pack` key (Collie reads `crew` and ignores the rest).

Non-goals:

- No migration or repair: Fleet still never rewrites, renames or reshapes trust state, and the
  previous release's no-op commit stays the operator's act.
- No change to upstream `bridge/crew/trust-store.ts` or any other upstream path; Collie's own loader
  keeps reading a pack-shaped store as "no crew" when it is started outside Fleet.
- No change to the existing file-name notice for a directory holding only `pack-trust.json`; that
  check still runs first and is Collie's.

Reused upstream behaviour: Collie's trust-store path composition, its parser and mode derivation, and
its legacy file-name notice. Fork-owned behaviour: the raw-shape check and its notice, in
`fleet/pack-authority.ts`, and its call from `fleet/pack-enrollment.ts`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-pack-authority`: adds a requirement that Fleet refuses, at start and before enrolment, a
  trust store in the pre-Collie-1.9 inner shape (`pack` without `crew`), naming the file and the keys
  and writing nothing.

## Impact

- Code: `fleet/pack-authority.ts` (new raw-shape guard, called from `validatePackAuthority`),
  `fleet/pack-enrollment.ts` (guard before the store is opened). Both are fork-owned under
  `fleet/**`; `FORK.toml` does not change.
- Tests: `fleet/pack-authority.test.ts`, `fleet/pack-enrollment.test.ts`.
- Docs: `docs/herdr-fleet.md` (native Pack authority section), `CHANGELOG.md`.
- Release: a PATCH. No member is obliged to redeploy for it, and a member whose store is already in
  the current shape behaves exactly as before.
