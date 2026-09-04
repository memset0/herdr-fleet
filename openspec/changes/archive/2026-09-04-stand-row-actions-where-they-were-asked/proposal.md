## Why

A row's actions are reached two ways — a phone's long press and a pointer's right-click — and both
land in the same bottom sheet, which is the right surface for exactly one of them. On a wide screen
the operator right-clicks a row near the top of a rail and the answer slides up from the bottom edge
of a 900px window: the verbs are as far from the row they are about as the screen allows, and the
gesture that asked for them is a context menu everywhere else on the machine.

The rename inside that sheet has the opposite problem the moment the sheet becomes a menu. A list of
verbs is happy in a 288px popover pinned to a corner; a question with a text field in it is not.

Nothing about the actions themselves is wrong — the rows, the capability gates, the host block, the
two-tap confirm and the writes are Collie's and stay exactly as they are. What follows the gesture is
where the surface STANDS.

## What Changes

- A right-click from a mouse opens the row's actions as a menu at the cursor, undimmed, and a long
  press keeps the bottom sheet unchanged.
- Once those rows become a rename's question, the same surface moves to the centre of the screen.
- The three surfaces that ask a row for its actions — the hierarchy, the tab strip and the pane
  strip — inherit this from the one pair of sheets they already share, so none of them defines a
  menu, a dialog, or a second rename.

Non-goals:

- Any change to which actions exist, what they do, their capability gating, their read-only refusal,
  their confirm flow, or any write.
- A keyboard shortcut surface. The gesture recorder answers where a pointer asked, and nothing else.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-native-navigation-sidebars`: the row's actions state where they stand, which follows the
  gesture that opened them.
- `fleet-pane-chrome`: the Pane page's strips inherit that stand rather than defining one.

## Impact

- Two fork-owned modules under `fleet/ui`, one fork-owned component, and one narrow port on Collie's
  sheet primitive plus one line in each of the two actions sheets.
- No dependency, route, loader, API call, mutation, backend state, or configuration change.
