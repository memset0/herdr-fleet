## Why

The row-actions menu was Collie's bottom sheet standing somewhere else — one primitive, six other
surfaces depending on it, and a placement branch inside it. That was the wrong seam, and the entrance
proved it: a box pinned by one corner and scaled from its own middle reads as being squeezed in from
every side at once, and no amount of correcting the origin made a sheet behave like a menu. Each
correction was another branch inside a shared primitive.

They are not the same object. A bottom sheet is a screen you have entered: it dims the app, sticks a
titled header over what scrolls under it, spends a thumb's 44px per verb and carries a ✕ because it
has taken the page over. A context menu is a small box beside the row it is about: it dims nothing,
names its target quietly, spends 28px per row for a cursor, and leaves when you look away or the page
scrolls under it.

## What Changes

- Collie's sheet primitive and both actions sheets go back to exactly what upstream wrote. The
  placement port is gone.
- The fork gets its own context menu and its own centred prompt, with its own density, its own
  dismissal — a press elsewhere, Escape, or the page moving — its own keyboard walk, and a fade with
  no scale and no travel.
- The choice is made at the INVOKE SITE, by the device: one drop-in per kind of row that takes the
  sheet's own props and renders the sheet unless a mouse's context gesture opened it. Each strip
  changes by one imported name; the fork's hierarchy changes by none.
- The menu composes its own rows and re-decides nothing: the capability gates, the host write block,
  the two-tap confirm, the press echo, the API calls and the status strings are imported from where
  the sheet gets them.

Non-goals:

- Any change to which actions exist, what they do, their gating, their refusals, or any write.
- Any change to the bottom sheet, on any surface, on any device.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-native-navigation-sidebars`: the row-actions requirement states that the two surfaces are
  two components chosen at the invoke site.
- `fleet-pane-chrome`: the strips inherit that choice through the same drop-in.

## Impact

- Three fork-owned components, two fork-owned geometry/gesture modules, and one imported name in each
  of the two strips. Collie's `ui/sheet.tsx`, `pane-actions-sheet.tsx` and `tab-actions-sheet.tsx`
  return to upstream.
- No dependency, route, loader, API call, mutation, backend state, or configuration change.
