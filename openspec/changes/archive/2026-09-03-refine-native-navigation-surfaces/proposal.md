## Why

The native navigation shell reapplied onto the exact Collie `v1.2.0` baseline is structurally in
place but wrong in operation. On a wide viewport it spends two controls collapsing rails the
operator always wants open, and its header runs edge to edge above both rails instead of belonging
to the route it heads. Below that threshold it adds a second chrome row whose stacking order paints
it over the very drawers it opens. The hierarchy itself renders every Space, Tab and Pane as its own
level even when a level has exactly one child, draws a folder on rows that group nothing, highlights
only part of a row, spaces its disclosure controls differently at each depth, and snaps open with no
motion at a row height built for a touch target rather than for a dense tree.

## What Changes

Wide layout (the viewport at which both rails are shown directly — the shell's existing threshold):

- Both rails are permanently expanded. **BREAKING** for stored preferences: the collapse control,
  the collapsed state, and the collapse/restore behavior are removed. Independent preferred widths,
  pointer and keyboard separators, bounds, and browser-local persistence are unchanged.
- The application header is confined to the centre column: the rails become the outermost full-height
  columns and the header heads only the route content between them.
- The Pane page's pane-switcher entry is hidden, because the hierarchy rail already offers every
  Pane on screen.
- Every route that is not a Pane — the dashboard, a Space, Settings, Pack — fills the route column
  instead of being centred inside a narrow reading column, and its header spans the same width.

Narrow layout:

- The shell's own hierarchy/Agent trigger row is removed, together with the stacking defect that let
  it paint above an open overlay.
- The hierarchy trigger moves into the application header's leading position.
- The Pane page's existing pane-switcher entry keeps its position, gesture and sheet, and presents
  the same native Agent rail the wide layout shows instead of the pane list. The Agent overlay
  drawer is removed with its trigger.

Hierarchy:

- A Host level is added above Spaces, derived from the snapshot the shell already reads. There is
  one Host heading today, naming the machine being viewed. This reserves the level a later
  Host-aware change needs and claims no Pack behavior.
- The panel is named for the herd rather than for Spaces alone, since Spaces are no longer its top
  level.
- A level with exactly one child is elided and its child is lifted into its place; the deeper name
  wins, so a Tab holding a single Pane presents that Pane's name and icon as a leaf row.
- A folder icon marks only a row that still groups more than one child after elision. Space rows
  carry no icon.
- The selected row's highlight covers the whole row including its disclosure control.
- One shared disclosure control is used at every depth, so its size, hit area and indentation are
  identical at each level.
- Disclosure opens and closes through Collie's existing in-flow animation, and stays motionless
  under a reduced-motion preference.
- Row density is tightened for a tree; a touch-sized row height is kept where the hierarchy is
  operated by touch.

Non-goals:

- Pack membership, Host switching, peer reachability, trust, or any claim that more than one Host
  can be reached. The Host level is presentational and reads only the existing snapshot.
- An iframe, `postMessage`, second router, extra snapshot request, loader, API, backend, or
  mutation change.
- Redesigning Agent cards, favorites, triage, manual Pane fit, the composer, mobile Tab/Pane strips,
  action sheets, the Pane page's own thread sidebar, notifications, ttyd, release, or deployment.
- Changing Collie's route set, navigation helpers, scope rules, or Pane page behavior beyond the
  enumerated ports.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-native-navigation-sidebars`: wide-layout rails lose collapse and gain a header that no
  longer spans them; the responsive trigger row is replaced by a header-leading hierarchy trigger and
  an Agent-presenting pane switcher; the hierarchy gains a Host level, single-child elision,
  group-only folder icons, whole-row highlight, one shared disclosure control, animated disclosure,
  and tightened density; navigation preferences drop collapsed state while keeping bounded widths and
  disclosure.

## Impact

- Fork-owned: the navigation model and preference modules under `fleet/ui/native-navigation/`, and
  the shell, tree and Agent rail components under `web/src/components/`.
- Invasive ports, each recorded in `FORK.toml`: one optional leading slot on the application header,
  the root route's shell/header nesting, the Pane page's switcher visibility and sheet content, and
  the content-width claim on the four non-Pane routes.
- Six existing translation dictionaries gain, drop and rename navigation labels.
- No dependency, route, loader, API call, mutation, backend state, configuration field, plugin
  action, or release change.
