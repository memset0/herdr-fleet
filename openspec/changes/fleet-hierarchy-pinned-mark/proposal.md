## Why

A pane the operator pinned is marked only in the Agent rail (its pressed star and the Pinned group).
In the hierarchy rail the same pane's row looks exactly like every other row, so an operator
scanning the Host → Space → Tab → Pane tree cannot tell which panes they chose to keep in front.

## What Changes

Baseline: Collie v1.23.3 as recorded in `UPSTREAM.md`; Fleet 3.24.0.

- A hierarchy row that stands for a Pane pinned in Collie's own per-device pin store (`lib/pins.ts`,
  the same pin the Agent rail's star toggles) draws its title bold and a small "pinned" badge right
  after the title.
- The same mark applies to a merged single-Pane Tab row when its one Pane is pinned.
- Rows that are not pinned, and Host, Space and Tab group rows, are unchanged.
- The mark follows pin changes live, because Collie's pin store already notifies its readers.
- The badge never pushes the row's trailing state dot off the row; the title truncates first.

Non-goals:

- No new pin storage, no new pin entry point, no change to how pinning is matched.
- Pin state stays browser-local: nothing is added to the snapshot, the Gateway, the bridge or any API.
- The Agent rail, Collie's dashboard and Collie's sheets are not changed.

Reused upstream behavior: Collie's pin store and matcher (`usePins`, `pinMatcher`) and the `ui/badge`
primitive. Fork-owned behavior: the navigation model's `pinned` presentation field, the shell's
derivation of it, and the row's mark.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-native-navigation-sidebars`: a hierarchy row standing for a pinned Pane carries a pinned
  mark.

## Impact

- `fleet/ui/native-navigation/model.ts` (fork-owned): optional `pinned` on the Pane input and on a row.
- `web/src/components/native-navigation-shell.tsx` (fork-owned): derives `pinned` per Pane from
  Collie's pin store.
- `web/src/components/native-navigation-tree.tsx` (fork-owned): bold title and badge.
- `web/src/lib/fleet-i18n/*.ts` (fork-owned): one new string in all seven locales.
- Frontend bundle only — no bridge, crew wire or upstream-owned path changes; `FORK.toml` is not
  expected to move.
