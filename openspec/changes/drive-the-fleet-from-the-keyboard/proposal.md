## Why

Fleet is now a whole machine room in one page — every Pack member's Spaces, Tabs and Panes in the
left hierarchy, every member's Agents in the right rail — and the only way to reach any of it is the
pointer. Collie's baseline (v1.2.0) has no application-level keyboard layer at all: nothing in the
web tree reads a modifier, and the ordinal badge the Agent card already draws
(`NATIVE_AGENT_SHORTCUT_LIMIT`) answers to no key. An operator who keeps eight Panes open pays a
sighted, aimed click for every switch.

The downstream product this fork replaces solved that with a configurable command system, and its
requirements are known-good from real use. Reapplying them natively is also far smaller than the
original: that system spent half its surface on a cross-origin parent/child protocol — exact Window
and Origin checks, a configuration epoch, stale request ids, a bounded handler-registration race —
because the terminal lived in an iframe. Here there is one React application and none of that exists.

## What Changes

- Add a bounded, data-defined **command catalog**: every command has one stable English id, one
  English display name, one allowlisted action adapter, and zero or more effective bindings.
- Add a **binding grammar** with two shapes — a simultaneous direct chord, and a sequential prefix
  binding behind a configured prefix (default `Ctrl+B`) — plus a recognizer that matches physical key
  codes and exact modifiers, and rejects the chords a browser handles above the page.
- Define **focus arbitration**, which the framed original never had to state: an armed prefix
  preempts the composer and direct-typing mode (Escape, Tab and the arrows go to the recognizer)
  until the sequence completes or cancels; direct chords stay effective in every focus context.
- Add **`FleetCommandBar`**, one surface with two modes: a leading `/` searches the command catalog;
  any other input fuzzy-matches Panes and jumps to one. Its Pane list is snapshotted at invocation
  and never reordered while it stands.
- Add a **`PaneRoster` interface** as the single definition of the listable rows — the four triage
  sections, plus a fifth `shell` section that only the command bar reads — so the rail, the command
  bar's snapshot, and the Agent cycling and ordinal commands can no longer order the same rows
  differently. The Agent surface keeps its existing rule that shell rows never appear in it.
- Add **Fleet's own settings file**: one JSON document beside `fleet.toml` in the plugin config dir,
  served and written by Fleet's own Gateway. Reads are mtime-checked and hold the last good document
  on a parse failure; writes are atomic and guarded by the mtime the client read.
- Group **every Fleet setting into one section at the head of Collie's Settings page**, and edit the
  bindings there as a JSON text area that refuses to save a document that does not parse, names an
  unknown command, or spells a binding the recognizer rejects.
- Ship **no direct-chord defaults except the command bar's own**. The Alt family the original grew
  is dropped from the public defaults; every command stays discoverable in the bar and bindable in
  the settings file.

### Non-goals

- The cross-origin parent/child command protocol, its Window/Origin validation, its configuration
  epoch and its handler-registration race. This fork has no iframe; none of it is reapplied.
- Collie's own Agent slash-command palette (`components/command-palette.tsx`). It keeps its name,
  its bottom sheet and its behavior; the new surface is a different component.
- Moving browser-local Fleet preferences — rail widths, the CJK fallback face, Agent favorites — into
  the settings file. They stay per-device, which is what Collie's own split already decides for a
  preference whose subject is the device.
- Rendering the `shell` roster section in the right rail. This change unifies the model; whether the
  rail draws that section is a separate decision.
- A visual binding editor. The text area is the whole editing surface for now.
- Any change under `bridge/`, and any private deployment content — the operator's own binding
  document belongs to the private management scope, not to this repository.

## Capabilities

### New Capabilities

- `fleet-keyboard-commands`: the command catalog, the binding grammar and its rejections, the
  prefix/direct recognizer, focus arbitration against the composer and direct-typing mode, the single
  dispatch path shared by every invocation source, and the acknowledgement it shows.
- `fleet-command-bar`: the one discovery-and-invocation surface, its command mode and its Pane
  jump mode, the invocation-time roster snapshot, fuzzy matching, focus behavior and activation.
- `fleet-settings`: Fleet's own settings document and its Gateway read/write contract, the failure
  posture on a malformed file, concurrent-write detection, and the Fleet section at the head of
  Collie's Settings page with its validating binding editor.

### Modified Capabilities

- `fleet-native-navigation-sidebars`: both rails gain a command that collapses and restores them
  together with a motion-aware bounded transition, preserving each rail's content, scroll position,
  disclosure state and preferred width.

Two capabilities are deliberately NOT modified. The Agent rail's visible order does not change, so
moving its composition into the shared roster is design rather than behavior. And `fleet-agent-favorites`
keeps its rule exactly as written — favorites sort first inside the existing triage sections, and shell
rows stay out of the Agent surface; the shell section exists only in the command bar, whose own spec
states how it is ordered.

## Impact

- New fork-owned modules under `fleet/ui/` for the catalog, the binding grammar, the recognizer, the
  roster and the fuzzy matcher, all pure and covered by the root suite; new fork-owned components for
  the command bar, its dialogs and the Fleet settings section.
- New Fleet Gateway routes and one settings document in the plugin config dir, alongside `fleet.toml`
  and under the same permissions. `bridge/` is untouched.
- Invasive ports into Collie-owned paths, each recorded in `FORK.toml`: the Settings page's Fleet
  section and its position, the Agent rail's order now arriving from the roster, and the Composer and
  Pane surfaces the Pane-scoped commands drive. Several of those paths are already attributed to an
  existing manifest entry and must ride it rather than opening a second one.
- `openspec/specs/fleet-native-navigation-sidebars/spec.md` is also deltaed by the active change
  `stop-calling-a-stale-receipt-unreachable`. The two deltas are disjoint in subject, but both must be
  re-read before either is synced.
