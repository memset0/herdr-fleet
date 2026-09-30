## Context

See proposal.md — Why. The private-fact guard (`scripts/check-private-facts.ts`) scans what
`FORK.toml` declares as ours, matches addresses, home paths and secrets by shape, and reads
shapeless names only from the ignored `LOCAL.md`'s `private-names` block. Both affected test files
are fork-owned, so the guard would have refused them had that block existed. Upstream's fixtures
already name their machines after outbuildings — `attic`, `workshop`, `lodge`, `shed` — so a
synthetic label in that convention reads as native to the codebase.

## Goals / Non-Goals

**Goals:**

- No real machine name and no private repository name in any fork-owned tracked file outside the
  archived changes.
- Every rewritten test keeps the distinction it exists to pin.
- On this checkout the guard passes on the scrubbed tree and demonstrably refuses a reintroduced
  name.

**Non-Goals:**

- Changing the guard's rules, output, or scan set.
- Editing archived changes or upstream-owned files.

## Decisions

- **Outbuilding labels, chosen per role.** The roster fixture's lead becomes id `lead` with a
  display name distinct from its id, and its peer keeps id equal to name, so the "resolve the lead's
  id to its name" and "keep the id for identity" cases still assert different things. The rail's Tab
  label becomes a single outbuilding word, and its workspace label becomes a neutral project word.
  Alternative considered: generic `host-a`/`host-b`. Rejected because upstream's convention already
  exists and a reader of the neighbouring upstream tests recognises it.
- **The guard is armed locally, not changed.** The fix to "names were never checked" is the
  operator's `private-names` block in the ignored file, as the requirement and `AGENTS.md` already
  prescribe. Widening the guard with a built-in list would write the forbidden values into the tree.
  The block names machine identifiers only, not common library words that happen to share a prefix
  with one, so a public dependency name is not reported.
- **Archived changes are reported, not rewritten.** The guard skips `openspec/changes/archive/` on
  purpose; the paths still carrying names are listed for the owner outside the tree.

## Risks / Trade-offs

- [The guard's protection depends on each checkout's local file] → Unchanged by this change and
  already stated by the guard's own blind-spot line; this checkout now has the block.
- [A synthetic label could collide with a word used elsewhere in the same test] → Each label is
  checked against its test file before use, and the affected tests are run.
