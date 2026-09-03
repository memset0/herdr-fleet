## Context

See proposal.md — Why. The shell exists and is fork-owned; this change reshapes it rather than
introducing it. Three facts constrain the approach:

- The application header is one instance mounted above the outlet, and routes portal their own
  content into it through a claim/slot contract. It cannot move into a route, and a route cannot
  render a second copy.
- The pane-switcher entry, its swipe gesture, and its sheet live inside the Pane page, which is
  Collie-owned and far from the shell. The shell cannot reach it by props.
- Navigation preferences are already a versioned browser-local record with a strict parser that
  rejects any record carrying an unexpected key.

The wide-layout threshold is the shell's existing one; "wide" and "narrow" below mean that same
breakpoint, so "the layout that shows both rails" and "desktop" stay one definition.

## Goals / Non-Goals

**Goals:**

- Keep every piece of downstream logic — derivation, elision, bounds, preferences, host naming — in
  `fleet/ui/native-navigation/` and in fork-owned components.
- Add at most three narrow ports to Collie-owned files, each a slot or a value, none carrying Fleet
  logic.
- Reuse Collie's own primitives for anything already solved upstream: the in-flow animation, the
  bottom sheet, the Agent list, the button, the icon set, the host roster helpers.
- Preserve stored widths and disclosure across the preference schema change.

**Non-Goals:**

- Reworking the header's claim contract, the sheet's gesture, or the Agent list's internals.
- A generic "sidebar" or "tree" abstraction. There are two rails and one tree; a framework for them
  would be larger than they are.

## Decisions

### The shell wraps the header instead of the reverse

The root route nests `NativeNavigationShell` outside the header host, and the header host renders
inside the shell's route column. That single re-nesting is what confines the header to the centre
column, because the rails are then siblings of the column the header heads rather than of the header
itself. The header keeps its own element, sticky behavior, safe-area inset, prerelease strip and
portal hosts untouched — it simply has a narrower parent.

Alternative considered: leave the nesting alone and pull the rails up with negative offsets or a
grid whose header cell spans one column. Rejected: it makes the rails' geometry depend on the
header's height, which is exactly the coupling the current layout suffers from, and it would break
the moment the prerelease strip appears.

### Route width is dropped at the four routes that opted into a reading column

The dashboard, Space, Settings and Pack routes each wrap their content in a centred
`max-w-screen-sm` column and each claim the matching narrow header. Both halves are removed at those
four call sites: the wrapper keeps its flex behavior and loses its centring and its cap, and the
route stops claiming the narrow header, which falls back to the header's existing full-width default.
Nothing in the header's claim contract changes, so the mechanism — and the pane and history routes
that never used it — is untouched.

Alternative considered: keep the claim and widen the cap. Rejected: a wider cap is still a cap, and
the shell already bounds the content by placing the rails beside it.

### The hierarchy trigger is a fork component passed through one header slot

`AppHeaderHost` gains an optional `leading` node rendered at the start of the header row. Fleet
passes its own trigger component, which reads the shell's open state from a fork-owned context and
hides itself on a wide viewport. The header therefore knows nothing about the hierarchy, and the
trigger knows nothing about the header.

The slot renders inside the header's non-override branch, so a route that takes the whole row (the
find bar, Settings, Pack) still owns it completely. That costs the trigger on those routes; the
alternative — a trigger that competes with the find bar for a phone's row width — is worse, and
those routes are reached and left by native navigation that is unaffected.

Alternative considered: a portal from the shell into a header slot. Rejected: the header already
owns three portal hosts for route content, and a fourth host whose only client is the shell is more
machinery than one optional prop.

### The pane switcher receives its content through a fork-owned context

The Pane page asks a fork hook for a switcher presentation. When the shell provides one — which is
whenever the Pane page is inside the shell, i.e. always — the sheet renders that content under that
title; otherwise the Pane page keeps its own pane list, so the component still stands alone in
Collie's own tests and playground. The shell supplies the same Agent rail element it renders in the
right rail, built from the same snapshot rows and the same open handler, so there is one Agent
surface with two mount points.

The entry itself is hidden on a wide viewport by a class on its container rather than by a
JavaScript media query: the gesture, the sheet, and the collapse behavior stay exactly as upstream
wrote them, and nothing has to re-render on resize.

Alternative considered: prop-drilling the content from the root route through the Pane route into
the page. Rejected: it would touch three Collie-owned files instead of one and put a Fleet-shaped
prop on a route boundary that has no other reason to know about Fleet.

### Elision happens in the model, not in the component

`deriveNavigationTree` returns rows that are already elided: a row carries its own depth, label,
icon kind, disclosure identity, and children. Single-child collapsing, deeper-name-wins, and
"group icon only when more than one child remains" are decided once, in a pure function, and tested
there. The component walks rows and renders; it makes no structural decision.

This also keeps the Host level honest. The model reads the existing roster the snapshot already
carries and names the row through Collie's existing host-naming helper, falling back to a generic
label when a solo snapshot names nothing. No new request, no Pack claim, no scope change.

Alternative considered: keep the three fixed levels in the component and hide rows with CSS.
Rejected: a hidden row still contributes an indentation step and a disclosure identity, so stored
disclosure state and the ancestry auto-disclosure would drift from what is on screen.

### One row primitive carries highlight, disclosure and indentation

A single fork-owned row component renders the disclosure control, the icon, the label, and the
indentation guide, and carries the selected/hover background itself. The disclosure control and the
row's activation are separate buttons inside that row, because a button inside a button is invalid;
the highlight belongs to the row element that contains both, which is what makes it cover the
disclosure control. Every depth uses this one component, so size, hit area and indentation cannot
drift between levels again.

Density is expressed as one compact row height at the wide breakpoint and a touch-sized height
below it, on the same element. The overlay and the rail therefore share the component without a
mode flag.

### Disclosure animates through Collie's existing in-flow collapse

Children are wrapped in the upstream `Collapse`, which owns the 240ms in-flow transition, the
delayed unmount that keeps a closing subtree out of the tab order, and the reduced-motion snap. It
replaces the current `hidden`/`inert` pair, so the inertness that the spec requires now comes from
the same component that provides the motion.

### Collapsed state is dropped by tolerating it, not by versioning

The preference parser keeps accepting a `collapsed` key on either rail and discards its value; the
in-memory shape no longer has the field and no writer emits it. A record written by the previous
shell therefore keeps its widths and disclosure instead of failing the strict-key check and
resetting to defaults. The storage key and version are unchanged, which also means a browser that
downgrades keeps working.

Alternative considered: bump the version and migrate. Rejected: a migration path exists only to
carry two fields that tolerating the old key carries for free, and a version bump would discard the
record for anyone who moved between builds.

## Risks / Trade-offs

- [The header's leading slot is empty on override routes, so the hierarchy trigger disappears on
  Settings, Pack, and while the find bar is open] → Those routes are entered and left by ordinary
  navigation, and the pane switcher still reaches the Agents; the alternative crowds the find bar on
  the narrowest viewport this app supports.
- [Making the whole route column inert while the hierarchy overlay is open also makes the header
  inert, so the trigger cannot toggle the overlay closed] → The overlay closes by backdrop, close
  control, Escape, and navigation; focus returns to the trigger from an effect that runs after the
  inertness is lifted, not from a frame callback.
- [Elision changes which disclosure identities exist, so a stored record may hold identities that no
  longer appear] → Identities remain bounded and are ignored when absent; the record is not
  invalidated, and ancestry auto-disclosure re-establishes what the operator needs.
- [A tighter row height reduces the pointer target on a wide viewport] → The compact height applies
  only at the breakpoint where the rails are permanently on screen and a mouse is the expected
  input; the overlay keeps the touch-sized row.
- [The Host level looks like Pack support before Pack exists] → It is derived from the snapshot's
  existing roster only, renders one row when there is no roster, and offers no Host switch; the spec
  states the presentational boundary and the tests assert the solo case.

## Migration Plan

No deployment step. The change is browser-side; an existing preference record upgrades in place on
first read, and no configuration, plugin action, or service behavior changes.
