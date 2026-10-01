## Context

See proposal.md — Why. The adopted Collie (`v1.14.2`) parses a trust store in
`bridge/crew/trust-store.ts`: `parseTrustStore` reads `d.crew` and, when it is absent, returns a
valid store with `crew = null`. Mode derivation (`bridge/crew/mode.ts`) looks at `lead` and `peers`,
not at the crew identity, so a pack-shaped peer store derives native Peer mode and passes Fleet's
`validatePackAuthority` today. Collie's own legacy notice (`legacyStateFileNotice`) covers only the
1.7.0 file NAMES, not the inner shape.

Fleet already validates authority through a read-only io of its own (`readOnlyTrustStoreIo` in
`fleet/pack-authority.ts`) and composes the file path with Collie's `trustStorePath`. Enrolment
(`fleet/pack-enrollment.ts`) opens Collie's `TrustStore` with the default io and drives Collie's
transitions; a pack-shaped store loaded there is "no crew", and a transition's write would serialise
the whitelisted fields only, dropping the `pack` object — the member's crew identity and secret.

## Goals / Non-Goals

**Goals:**
- Detect the pre-1.9 inner shape from the raw document and refuse it on every path that validates
  authority or opens the store for enrolment, before anything else reads or writes it.
- Keep the guard wholly in fork-owned code, with no new invasive path.

**Non-Goals:**
- Repairing, migrating or rewriting the store, or teaching Collie's parser the old shape.
- Validating the rest of the document; Collie's parser stays the only structural authority.

## Decisions

1. **Raw-key check in `fleet/pack-authority.ts`, not a change to `parseTrustStore`.** The guard reads
   `trustStorePath(stateDir)` through `readOnlyTrustStoreIo()`, parses JSON, and inspects only the
   top-level own keys: `pack` present and `crew` absent refuses. Teaching upstream's parser to refuse
   would be an invasive edit to a security file for a result reachable from a file we own; the fork
   boundary rule picks the owned module. `FORK.toml` is unchanged (`fleet/**` is already owned).
2. **Key presence, not value.** `crew` present (even `null`) means the store was written by a reader
   that knows the current shape, so it proceeds; `pack` present with any value and `crew` absent is
   the old shape. A store with both keys proceeds because Collie reads `crew` and the stray key is
   inert. This matches the requirement's wording and keeps the check independent of values, so the
   notice can never be tempted to echo one.
3. **Unparseable or non-object documents are not this guard's decision.** They fall through to the
   existing "unavailable or invalid" path, so the guard adds one refusal and changes no other message.
4. **Order.** In `validatePackAuthority` the guard runs after Collie's file-name notice (that notice is
   about which file exists; this one is about the file that does) and before the injected reader. In
   enrolment, `openStoreForEnrolment` becomes async and runs both checks before constructing the
   `TrustStore`, so no identity is minted and no lead is dialled.
5. **Notice text** (path interpolated, keys only):
   `[fleet] <path> is a trust store in the pre-Collie-1.9 shape: it has the top-level key "pack" and no
   "crew", so this release would read it as holding no crew. Fleet has started nothing and changed
   nothing. Rewrite the store with this member's previous Fleet release (3.4.x) — its own trust-store
   no-op commit writes the current shape — then run this release.`

## Risks / Trade-offs

- [The raw file is read twice at start (guard, then Collie's reader)] → It is one small local file on
  a cold path; a shared read would need an upstream seam, which costs more than it saves.
- [A future Collie re-introduces a top-level `pack` key alongside `crew`] → Both-keys proceeds, so the
  guard cannot fire on such a store.
- [An operator without a 3.4.x checkout] → The notice names the release line; the earlier adoption's
  repair used exactly that path, and nothing here forecloses the hand edits Collie documents.

## Migration Plan

PATCH release 3.5.1. A member whose store is crew-shaped behaves exactly as on 3.5.0; a member with a
pack-shaped store is now refused with the notice instead of starting and refusing its lead.
Rollback is a plain redeploy of 3.5.0.
