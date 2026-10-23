## Why

Pinning a pane and editing its tags are reachable today only from the Agent rail's trailing star and
tag buttons (and pinning from Collie's touch sheet). An operator working in the hierarchy rail with a
mouse right-clicks a Pane row and finds rename, focus and close, but not the two per-pane verbs they
reach for most, so they have to find the same pane again in the other rail.

## What Changes

Baseline: Collie v1.22.6 as recorded in `UPSTREAM.md`; Fleet 3.22.0.

- The fork's pointer context menu for a Pane (`FleetPaneActions`) gains **Pin to top / Unpin**, using
  Collie's own per-device pin store exactly as Collie's Pane actions sheet does, and **Edit pane
  tags**, opening Fleet's existing tag assignment editor for that pane.
- A hierarchy row that stands in for an elided Tab (a Tab holding exactly one Pane) keeps the Tab's
  rename/close, and its pointer menu additionally offers the same Pin and Edit pane tags for the one
  Pane it shows.
- Both verbs stay available when the device is read-only or the host refuses writes, as the rail's
  star and tag button and Collie's sheet already are: pinning is device-local, and tags are the lead's
  own authenticated store, not a terminal write.
- Shell panes get Pin (Collie's sheet offers it) but no tag entry (the rail offers none for shells).

Non-goals:

- Collie's touch bottom sheets are not changed; the long-press path on a phone keeps upstream's rows.
- No new pin or tag storage, no new tag editor, no new route or bridge surface.
- Host, Space and multi-pane Tab group rows gain nothing.

Reused upstream behavior: Collie's pin store (`lib/pins.ts`), its pin labels and status strings.
Fork-owned behavior: the menu rows, the merged-row pane reference and the tag-editor entry.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-native-navigation-sidebars`: the pointer menu for a Pane, and for a merged single-Pane Tab
  row, offers pin and tag editing for that Pane.

## Impact

- `web/src/components/fleet-row-actions.tsx` (fork-owned): new menu rows; `FleetTabActions` accepts
  the merged row's pane.
- `web/src/components/fleet-pane-tags.tsx` (fork-owned): a hook that exposes the existing editor's
  opener.
- `fleet/ui/native-navigation/model.ts` (fork-owned): the merged row's Tab subject names its Pane.
- `web/src/components/native-navigation-shell.tsx` (fork-owned): resolves and passes that Pane.
- Frontend bundle only — no bridge, crew wire or upstream-owned file changes; `FORK.toml` is not
  expected to move.
