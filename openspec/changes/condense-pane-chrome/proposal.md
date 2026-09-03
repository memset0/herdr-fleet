## Why

On the exact Collie `v1.2.0` baseline the Pane screen spends rows on things that already have a
place. The pane's state — Working, Ready, Idle — takes a full-bleed 14px band of its own above the
composer, when the strip row directly above the mirror already reserves 44px and ends in a control.
The five controls under the mirror stack their icon over their word, so a row of five reaches 44px
for two lines of 10px type, and the fifth is an unlabelled icon that reads as a different rank from
its four neighbours. The Collie mark spends 44px of the pane's header naming the app the operator is
already inside, on the one route whose row is entirely breadcrumb.

Two more things came back from reading the shell against a real herd. The header and both rails are
the page colour, so chrome and content share a ground and the rails read as more page. And a row in
the hierarchy leads with the Agent's own logo, which took the slot the state used to occupy — the
tree lost the one thing the Tab row above it still shows.

## What Changes

- The pane's state moves to a badge at the trailing end of the strip row, beside the fold control,
  in pixels that row already spends. The composer's band keeps the word only where that row is not
  on screen — folded, zen, or a pane with no strips — and leaves entirely when it would be empty.
- The five controls put their icon beside their word, at one icon size, and the fifth gains its own
  word, so all five read as one rank.
- The Pane route draws no Collie mark. Every other route keeps it.
- The header and both rails stand on the raised chrome ground the composer dock already uses,
  leaving the page and the mirror their own.
- Every hierarchy row that stands for a Pane carries the same state dot the Tab row draws, at its
  trailing end.
- Automatic disclosure fires when the selected Pane changes and at no other time, so collapsing the
  branch you are standing in is not undone by the next poll.
- The disclosure column is narrower, the indentation step is shorter, and a rail's title sits
  directly over its list.

Non-goals:

- The composer's own behavior, the gesture, the sheet, the strips' fold rule, zen, Pack, the Agent
  rail's contents, or anything on a route that is not a Pane beyond the header's ground and mark.

## Capabilities

### New Capabilities

- `fleet-pane-chrome`: where the Pane screen says the pane's state, how its controls are ranked, and
  which of the header's fixtures that route declines.

### Modified Capabilities

- `fleet-native-navigation-sidebars`: the shell's surfaces take the chrome ground, hierarchy rows
  carry their Pane's state, automatic disclosure is bound to a change of Pane, and the rails spend
  less on their own chrome.

## Impact

- Fork-owned: the navigation model, tree and shell.
- Invasive ports, recorded in `FORK.toml`: one status-word switch and one dock anchor on the
  composer, one mark claim on the header, one paper value on the mark, and the badge in the Pane
  page's existing strip trailing.
- No dependency, route, loader, API call, mutation, backend state, or configuration change.
