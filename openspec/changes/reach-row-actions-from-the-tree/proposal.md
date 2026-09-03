## Why

Renaming a Pane or a Tab, and closing one, are things the operator does from wherever they are
looking at it — and on the exact Collie `v1.2.0` baseline the only places that offer them are the
Pane page's own strips and its header menu. The hierarchy lists every Pane on the machine and offers
none of them, so the one surface built for reaching work is the one surface you cannot act from.

Nothing new has to be built for it: Collie already has the sheets, the writes, and the rules for
both, and the rail's rows arrived a moment ago at a density the operator read as too tight.

## What Changes

- A hierarchy row's own actions open on a right-click and on a long press. A row that stands for a
  Pane opens Collie's Pane sheet; a Tab group row opens its Tab sheet. Both are Collie's own,
  unchanged, so a rename from the tree is the rename the Pane pill already does.
- A Space row offers nothing, because the bridge has no rename or close for a Space and a row that
  offered one would be offering an action that cannot land.
- The Agent rail's rows are given more air between them; their type is unchanged.

Non-goals:

- A rename or close for a Space or a Host, a second copy of either write, a context menu of the
  fork's own drawing, or any change to what the sheets do.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-native-navigation-sidebars`: hierarchy rows reach the actions Collie already has for the
  thing they stand for.

## Impact

- Fork-owned: the navigation model gains what a row's actions would act on; the tree opens them; the
  shell mounts Collie's two sheets.
- No new invasive port: the sheets are imported, not modified.
- No dependency, route, loader, API, backend state, or configuration change.
