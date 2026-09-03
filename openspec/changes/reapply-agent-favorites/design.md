## Context

See `proposal.md` for motivation and `specs/fleet-agent-favorites/spec.md` for behavior. Collie
v1.2.0 already has one shared `AgentList`, an `AgentCard` whose whole row is a button, and a single
`triage()` function that owns section classification and native ordering. The downstream change
must add presentation state without moving those upstream responsibilities into Fleet code.

## Goals / Non-Goals

**Goals:**

- Keep favorite identity, validation, bounds, persistence, and stable partitioning in a
  fork-owned module under `fleet/ui/`.
- Expose only narrow favorite state/toggle props through the native Agent list and card.
- Preserve valid interactive markup, row navigation, focus, accessibility, i18n, and every native
  triage comparator.
- Keep solo and optional Host/session rows on one identity contract without activating Pack.

**Non-Goals:**

- A backend favorite model, synchronization, API, Gateway or configuration field.
- A replacement triage classifier/comparator, route, loader, Settings page, outer shell, iframe, or
  alternate Agent list.
- Pack, peer, SSH, notification, shortcut, ttyd, STT, release, or deployment mechanism changes.

## Decisions

### 1. Store ordered favorite identities in a fork-owned singleton

Add a pure `fleet/ui/agent-favorites.ts` module with a structurally typed identity input, a
versioned storage codec, one bounded ordered Set, subscribe/read/toggle operations, and a pure
stable-partition helper. The module does not import Collie's `AgentView`; the native object satisfies
the narrow `{ host?, session?, paneId, agent, kind? }` shape structurally.

The storage record uses tuples with explicit nullable Host/session fields rather than a delimiter-
joined string, so missing scope and strings containing punctuation cannot collide. Reads reject an
unknown version, invalid tuple, duplicate/oversized field, excessive byte length, or excessive
entry count. Adding at capacity evicts the oldest retained identity. A failed write keeps the
bounded in-memory result for the current page.

Alternatives rejected:

- Store favorites in the bridge or `fleet.toml`: turns a per-browser presentation preference into
  synchronized authority and adds an unnecessary API.
- Key only by Pane id: aliases panes across Hosts, sessions, and Agent implementations.
- Put storage logic under `web/src/lib`: makes substantive downstream behavior an upstream-owned
  port instead of owned Fleet code.

### 2. Partition after native triage rather than changing its comparator

`AgentList` continues to call `triage(agents, recentDir)` first. It then applies the owned
favorite-first stable partition independently to each returned section. Filtering into favorite
and non-favorite arrays and concatenating them preserves the native comparator's order in both
partitions and naturally retains `Recent` direction.

This avoids teaching `triage()` downstream state, changing section metadata, or duplicating
classification. It also keeps every non-Fleet caller of `triage()` byte-for-byte unchanged.

### 3. Render the favorite control as a sibling of the row button

`AgentCard` currently renders the entire row as a `<button>`, so nesting another button would be
invalid and would entangle favorite activation with navigation. The narrow port wraps the row in a
positioned container and renders the favorite button as its sibling, visually placed in the
upper-right/trailing area. The row receives only enough trailing space to prevent overlap.

The favorite button owns `aria-pressed`, a localized accessible label, and its own click handler.
Because it is not a descendant of the row button, activation does not dispatch the row action and
browser focus stays on the favorite control. Shell rows omit the sibling and retain the original
shape.

Alternatives rejected:

- Convert the row to `div role=button`: weakens native button keyboard behavior and broadens the
  invasive change.
- Put one button inside another: invalid interactive markup and unreliable event behavior.
- Make the star part of row navigation: cannot preserve independent focus or no-navigation
  semantics.

### 4. Keep the React subscription adapter in the native list

The owned store remains framework-light. `AgentList` uses the existing React primitives to
subscribe to its revision/snapshot and passes `favorite` plus one toggle callback to each
`AgentCard`. This is a narrow host adapter; parsing, state transitions, storage, identity, bounds,
and sorting remain owned.

The control's user-facing labels are added to every existing typed i18n dictionary. No new Settings
surface is introduced.

### 5. Classify every new and invasive path in `FORK.toml`

Add `fleet/ui/**` to a dedicated owned boundary with its focused tests. Record exact invasive ports
for `agent-list.tsx`, `agent-card.tsx`, their focused tests, and the typed i18n keys. No router,
loader, API, service-worker, Gateway, bridge, or lifecycle path is added.

## Risks / Trade-offs

- **[An overlay control can cover row content]** -> Reserve one fixed trailing slot and test both
  card and flat-row densities with age, Host, session, and status metadata.
- **[Malformed storage causes repeated failures]** -> Parse once into bounded memory, fail closed to
  an empty Set, and never require successful persistence for interaction.
- **[Favorite updates disturb native ordering]** -> Partition only the already-sorted section
  arrays and test equal/tied timestamps plus both Recent directions.
- **[Optional Host/session fields later appear]** -> Include them now as nullable tuple members
  without enabling or specifying Pack behavior.
- **[New labels drift across locales]** -> Use the existing typed dictionary contract so missing
  locale entries fail typecheck.

## Migration Plan

1. Add the owned identity/store/partition module and focused pure tests.
2. Add the native list subscription and favorite partition port.
3. Add the sibling control to the card with focused interaction/accessibility tests and typed i18n.
4. Update `FORK.toml` and `CHANGELOG.md`; run focused tests during implementation.
5. At commit readiness, run the full root/Web/typecheck/lint/build/fork/OpenSpec gates once, push
   the exact candidate, and deploy that commit through the existing isolated staging workflow for
   owner browser acceptance.
6. Roll back by redeploying the previous exact staging commit or removing the narrow list/card
   ports and owned module; no server or user-data
   migration is required because the browser-local record is ignored by builds without the feature.
