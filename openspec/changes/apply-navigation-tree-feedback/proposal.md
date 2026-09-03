## Why

The refined hierarchy shipped on the exact Collie `v1.2.0` baseline and the operator read it against
a real herd. Four things are wrong there. Every Tab in that herd holds exactly one Pane and no Pane
carries a name of its own, so every elided row fell through to a terminal title — two sibling rows
both reading `mem-research-harness` while the names the operator actually chose, on the Tabs, were
dropped. The Host is a heading with no control, which is the wrong shape for the level a second
machine will join. A Space row navigates away instead of opening, which is not what a row with a
disclosure control in front of it promises. And the tree spends more indentation and more rule than
it needs: a hairline under each rail's title cuts it off from the list it names.

## What Changes

- The Host becomes a disclosable row with its own control, disclosed by default and remembered when
  the operator collapses it. A second machine joins as a sibling row rather than as a new shape.
- Activating a Space row discloses it instead of navigating. A Space with nothing under it keeps its
  existing Space-route activation, since there is nothing to disclose.
- An elided single-Pane Tab presents the Pane's own chosen name when it has one, and the Tab's name
  otherwise — the operator's chosen name in both cases, rather than a terminal title that repeats
  across siblings. Panes inside a Tab that survives keep their existing presentation, which is what
  distinguishes them from each other.
- The indentation step is smaller, and each rail's title is no longer separated from its list by a
  rule.

Non-goals:

- Changing the elision rule itself, the group-icon rule, the disclosure animation, the density of a
  row, Pack behavior, or anything outside the hierarchy and the two rail titles.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-native-navigation-sidebars`: the Host level gains a default-disclosed control, Space rows
  disclose rather than navigate, and an elided Tab's row is named by the operator's own name.

## Impact

- Fork-owned: the navigation model and preference identities under `fleet/ui/native-navigation/`,
  and the tree and shell components under `web/src/components/`.
- No new invasive port; the existing native-navigation boundary is unchanged.
- No dependency, route, loader, API call, mutation, backend state, or configuration change.
