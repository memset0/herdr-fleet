## Context

The hierarchy rail's row actions are answered by `fleet-row-actions.tsx`: on a fine pointer the
fork's `FleetContextMenu`, otherwise Collie's bottom sheet. Collie's Pane sheet already offers Pin /
Unpin through `lib/pins.ts`; the fork's Pane menu does not, and neither surface offers tags. Tags
live in `fleet-pane-tags.tsx`, whose provider (mounted by the navigation shell around every rail)
owns one editor instance and a private context. A merged single-Pane row's subject is
`{ kind: "tab", tabId }`, so today its menu has no handle on the Pane it shows.

## Goals / Non-Goals

**Goals:** the pointer menu reaches the same pin and the same tag editor the Agent rail reaches,
including from a merged row, with no new state.

**Non-Goals:** no change to Collie's sheets, to tag or pin storage, or to any upstream-owned path.

## Decisions

1. **Pin row copies the sheet's `togglePin`, not the rail's star.** It imports `usePins`,
   `pinMatcher` and `setPinned` from `lib/pins.ts` and Collie's own `paneActions.pin/unpin` strings, so
   the menu and the sheet it replaces cannot disagree. Close first, then write, as the sheet does.
   `herd` is the prop the sheet already accepts; the shell now passes its full pane list to both menus so the store can tell a live pin from a dormant one, and an absent herd still gets `[]`, matching the sheet.
2. **Tag row reuses the provider's existing editor.** `fleet-pane-tags.tsx` exports a small hook,
   `usePaneTagEditor()`, returning the provider's `open(place)` (or `null` outside a provider). The
   menu calls it with `tagPanePlace(pane)`. Alternative — mounting a second editor in the menu — was
   rejected: two editors would race one client and duplicate focus handling.
3. **Merged row names its Pane on the subject.** `NavigationSubject`'s tab variant gains an optional
   `paneId`, set only by the single-Pane elision branch in `model.ts`. The shell resolves it against
   `allPanes` (as it already resolves pane subjects) and passes it to `FleetTabActions` as an optional
   `pane`. Alternative — inferring "one pane in this tab" in the shell — was rejected because the
   model is the one place that decided the row was merged; recomputing invites disagreement.
4. **Both verbs sit outside the write gate.** The menu's `blocked` branch currently replaces all
   rows with a notice. The new rows render above that branch, mirroring the sheet's "reads lead,
   outside the gates" rule and the rail, which offers star and tags regardless of write refusal.
5. **Order:** reads (find, history, zen), then Pin, then Edit pane tags, then rename/focus/close —
   the sheet puts Pin last among the ungated rows; tags follow it as the other per-device-style verb.

## Risks / Trade-offs

- [Upstream v1.23.x adoption lands before apply and moves `lib/pins.ts` or the sheet's pin strings]
  → re-read both after the merge; the pin row imports, never re-derives, so a rename fails typecheck.
- [Touch users still lack tags in the long-press sheet] → accepted non-goal; the rail's tag button
  remains the touch path.

## Migration Plan

Frontend bundle only: a PATCH release; rebuilding on the lead makes it live. Archive after the
lead's focused tests and a visual check pass, before the release.
