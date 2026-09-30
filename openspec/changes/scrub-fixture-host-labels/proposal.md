## Why

Two fork-owned test files still name the operator's real machines. A verification run found that
the roster fixture uses real machine names as its host labels, and the Agent rail fixture uses one
as a Tab label; the roster fixture also labels its workspace with the operator's private repository
name. This is exactly the leak the private-fact guard exists to refuse, and the guard never saw it:
a machine named by an ordinary word has no shape, so it is caught only through the ignored local
context file's `private-names` block, and the checkout that wrote these fixtures had none.

Separately, the changelog's introduction has ended mid-sentence since the 3.3.0 release commit
rewrote it, so the paragraph that explains the Unreleased heading and the release rename no longer
says either.

Baseline: Collie v1.8.2, as recorded in `UPSTREAM.md`; this fork at 3.4.0.

## What Changes

- Replace every real machine name, and the private repository name, in fork-owned tracked fixtures
  with synthetic labels following upstream's own outbuilding convention (`lodge`, `workshop`,
  `attic`, `shed`), keeping each test's shape: the lead's id still differs from its display name,
  a peer's id still equals its name, and the rail row is still named by its Tab.
- Complete the truncated changelog sentence in the file's own voice and record the fixture scrub
  under `## [Unreleased]`.
- Operator-local only, never committed: give the ignored local context file a `private-names`
  block, so the existing guard actually checks those names on this checkout from now on.

Non-goals:

- Any change to what the private-fact guard does. Its requirement already says a shapeless name is
  caught through the local context file; the fault was that no such file carried one.
- Rewriting archived OpenSpec changes that carry the same names. They are historical records, the
  guard deliberately skips them, and correcting them needs the owner's explicit request; they are
  reported instead.
- Any upstream-owned file. Upstream's fixtures name upstream's own examples and are already public.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. `fleet-plugin-runtime` already requires the guard to refuse a shapeless private name that the
local context file records; this change removes the names from the tree and makes this checkout's
local file record them, so it declares `skip_specs`.

## Impact

- Two fork-owned web test files and `CHANGELOG.md`. Fixture labels only; no assertion is weakened.
- No product behaviour, dependency, route, API, configuration, version, or fork-boundary change;
  `FORK.toml` is untouched.
