# fleet-command-bar Specification

## Purpose
Give Fleet one keyboard-first overlay that both finds a command and jumps to a Pane, so discovery of
the command catalog and movement around a whole pack are the same surface rather than two.

## Requirements

### Requirement: One overlay carries both a command mode and a Pane mode
Fleet SHALL present one command bar overlay with two modes selected by the query's first character.
A query beginning with `/` SHALL be a command search over the catalog. Any other query, including an
empty one, SHALL be a Pane search.

`open-command-bar` SHALL open the overlay prefilled with `/` so it starts in command mode.
`open-pane-switcher` SHALL open the same overlay with an empty query so it starts in Pane mode.
Adding or removing a leading `/` SHALL switch modes in place without closing the overlay.

The overlay SHALL be a modal dialog with contained focus. Its input SHALL take focus on open,
`Escape` SHALL dismiss it, dismissal SHALL restore focus to where it was, and activating a result
SHALL close it. It MUST NOT accept a query as a URL, a request, a script, or terminal input.

#### Scenario: The two commands open the same surface
- **WHEN** the operator invokes `open-command-bar` and, separately, `open-pane-switcher`
- **THEN** the same overlay opens, differing only in whether the query starts as `/` or empty

#### Scenario: The operator switches modes while it stands
- **WHEN** the overlay is in Pane mode and the operator types a leading `/`
- **THEN** it becomes a command search over the same open overlay

#### Scenario: The overlay is dismissed
- **WHEN** the operator presses `Escape`
- **THEN** the overlay closes, nothing is invoked, and focus returns to where it was

### Requirement: Command mode lists the catalog with its effective bindings
With a query of exactly `/`, command mode SHALL list the whole catalog. Each result SHALL show the
command's English name and every one of its effective bindings; a command with no binding SHALL be
listed with an explicit "no binding" indication rather than omitted.

Text after the `/` SHALL fuzzy-match against the command's English id, English name and binding
labels, and the matched characters SHALL be marked in the result. Activating a result SHALL close the
overlay and invoke that command through the shared dispatcher.

#### Scenario: The catalog is browsed
- **WHEN** the query is exactly `/`
- **THEN** every command in the catalog is listed with its English name and its effective bindings

#### Scenario: An unbound command is listed
- **WHEN** a listed command has an empty binding list
- **THEN** it appears with its English name and an explicit no-binding indication

#### Scenario: A command is filtered and run
- **WHEN** the operator types after the `/` and activates a result
- **THEN** the overlay closes and the shared dispatcher invokes exactly that command

### Requirement: Pane mode lists a roster snapshot that never reorders
On opening in Pane mode, Fleet SHALL take one snapshot of the roster and SHALL present that snapshot,
unfiltered, for as long as the overlay stands. While the overlay is open, incoming state SHALL update
only what a row displays; it MUST NOT reorder the list, add a row, or remove one.

The snapshot SHALL be the roster's sections in their fixed order, flattened: `Needs you`,
`Ready · unseen`, `Working`, `Recent`, and last a `shell` section holding the Panes that are not
Agents. Inside every section, including `shell`, favorited rows SHALL come first while both partitions
keep that section's own order. The `shell` section SHALL order by last-seen, most recent first.

Typing SHALL fuzzy-match rows within that snapshot. Activating a row SHALL navigate to that exact Pane
through Fleet's canonical route. A row whose Pane the topology has since removed SHALL remain listed,
SHALL be shown as unavailable, and SHALL make no route change when activated.

#### Scenario: The overlay opens in Pane mode
- **WHEN** `open-pane-switcher` runs
- **THEN** every Pane in the roster is listed in the section order above, with shell Panes last

#### Scenario: State lands while the overlay stands
- **WHEN** a Pane changes status, or its triage section would change, while the overlay is open
- **THEN** its row updates what it shows and the list's order, membership and length are unchanged

#### Scenario: A shell Pane is reached
- **WHEN** the operator filters to a Pane that is not an Agent and activates it
- **THEN** Fleet navigates to that Pane through the canonical route

#### Scenario: A listed Pane has gone away
- **WHEN** the operator activates a row whose Pane the topology no longer contains
- **THEN** Fleet changes no route and reports one bounded unavailable result

### Requirement: The overlay is a top-anchored quick-input panel, not a sheet
The command bar SHALL present as one raised panel anchored near the top of the viewport and centred
horizontally, over a dimmed page, at a bounded comfortable width rather than filling the screen. It
MUST NOT reuse the bottom-sheet presentation Collie's own palettes use, so the two surfaces are never
mistaken for each other.

The panel SHALL lead with its query input and follow with its results. Its outer size SHALL NOT
change as results are filtered: the result region SHALL hold a bounded height and scroll within
itself, so typing never moves the input under the operator's hands or resizes the page behind it.

Each result SHALL be one dense row carrying, in reading order, a leading mark for what the row is,
its primary label, its secondary context, and — right-aligned at the row's trailing edge — its
bindings in command mode. The characters a query matched SHALL be visibly marked within the primary
label. The focused row SHALL be distinguishable from the merely hovered one.

In Pane mode the results SHALL carry the roster's section headings; a heading SHALL NOT be selectable
and SHALL NOT be reachable by the up and down keys.

The panel SHALL take its ground, rules, type and row height from the application's own design tokens
so it reads as part of this application, and SHALL render correctly in both themes.

#### Scenario: The overlay is opened over a page
- **WHEN** the command bar opens
- **THEN** it stands as one raised panel near the top of the viewport over a dimmed page, and is not presented as a bottom sheet

#### Scenario: The operator narrows a long list
- **WHEN** the query filters many results down to one
- **THEN** the panel's outer size and the input's position are unchanged and only the result region's content differs

#### Scenario: A command row is drawn
- **WHEN** command mode lists a bound command
- **THEN** the row shows its English name with the matched characters marked, and its bindings right-aligned at the row's trailing edge

#### Scenario: Section headings are skipped
- **WHEN** the operator holds the down key through a Pane list that has several sections
- **THEN** focus moves only between Pane rows and never lands on a heading

#### Scenario: The theme changes
- **WHEN** the overlay is shown in either theme
- **THEN** its ground, rules and text come from the application's tokens with no hard-coded colour

### Requirement: Keyboard selection starts at the first row and resets when the results change
In both modes the focused row SHALL start as the first result. The up and down keys SHALL move focus
within the current results and SHALL keep the focused row scrolled into view. `Enter` SHALL activate
the focused row.

Whenever editing the query changes the result set, focus SHALL return to the first result. When the
result set is empty, no row SHALL be focused and `Enter` SHALL do nothing.

#### Scenario: Focus starts at the top
- **WHEN** the overlay opens in either mode
- **THEN** the first result is focused

#### Scenario: The operator moves and activates
- **WHEN** the operator presses down twice and then `Enter`
- **THEN** the third result is activated and the overlay closes

#### Scenario: Editing the query changes the results
- **WHEN** the operator edits the query so that a different set of results matches
- **THEN** focus returns to the first result rather than staying at its previous index

#### Scenario: Nothing matches
- **WHEN** the query matches no result
- **THEN** the overlay says so, focuses no row, and `Enter` invokes nothing
