## Why

On Collie v1.5.2 (`cea2035e1f02d560d1bac66c85314828a7e01c20`), Fleet's terminal matches the mirror's horizontal padding but not its native vertical scrollbar reservation. Its fitted grid can therefore be wider than the mirror's explicit Resize Pane measurement.

## What Changes

- Reserve the browser's native vertical scrollbar gutter inside the terminal's real drawable layout, in addition to its existing symmetric padding.
- Target the mirror with a vertical scrollbar, as selected by the operator. Overlay scrollbars reserve zero width; a non-overflowing mirror may remain wider.
- Preserve measured whole-cell fitting and existing automatic geometry ownership, without calling the mirror's manual resize action or correcting reported columns independently of rendered width.
- Keep Collie's mirror, fonts, hidden-content fetching, scroll behavior, and terminal lifecycle unchanged.

Non-goals: dynamic matching to hidden mirror overflow, changing mirror layout, replay/session fixes, scrollbar UI, dependencies, peer changes, and font-metric unification.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-pane-terminal`: terminal horizontal clearance also reserves the native scrollbar gutter used by an overflowing mirror.

## Impact

Owned `web/src/components/fleet-terminal.tsx`, terminal documentation, changelog, and the owning specification. No new upstream port, backend API, dependency, or preference. Browser verification covers classic and overlay scrollbars, desktop/phone widths, actual FitAddon columns, and unchanged row fit.
