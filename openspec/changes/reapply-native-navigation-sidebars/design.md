## Context

See `proposal.md` and `specs/fleet-native-navigation-sidebars/spec.md`. Collie's root route already
owns the one snapshot loader and a persistent `AppHeaderHost` around `<Outlet />`; child routes
render native Home, Space, and Pane surfaces. The snapshot already contains the local workspaces,
tabs, Agent panes, and shell panes needed to derive a hierarchy, and `AgentList` already owns native
triage, favorite-aware order, cards, and Pane activation.

## Goals / Non-Goals

**Goals:**

- Keep hierarchy derivation, preference parsing/bounds, disclosure, overlay state, and resize math
  under `fleet/ui/native-navigation/`.
- Add one persistent root-shell port and small presentation-only tree/rail components.
- Reuse the current root snapshot, navigation helpers, router, outlet, and `AgentList`.
- Preserve keyboard, focus, inertness, reduced-motion, and malformed-storage behavior across
  desktop and responsive layouts.

**Non-Goals:**

- A new route, loader, request, router, API, Gateway, backend state, or mutation action.
- Host-aware hierarchy, Pack activation, or a claim that Pack exists in the first implementation.
- Replacing `ThreadSidebar`, mobile strips, Agent cards, favorite logic, manual fit, composer, or
  action sheets.

## Decisions

### 1. Wrap the existing outlet inside the already-persistent root

Add `NativeNavigationShell` inside `AppHeaderHost` at the current `<Outlet />` position in
`web/src/routes/root.tsx`. The root route remains mounted across child navigation, so the shell,
rail component identities, preferred widths, and overlay triggers survive Home → Space → Pane
without another router or cache. The shell receives the already-loaded `HomeData`; it never calls a
loader or API.

Alternatives rejected:

- Put sidebars in each route: duplicates state and remounts them during navigation.
- Add a parent router or framed app: violates the native SPA and authentication/cache boundaries.
- Move route content into Fleet-owned renderers: duplicates Collie's route behavior.

### 2. Keep substantive navigation behavior in one owned module family

Add structurally typed owned modules under `fleet/ui/native-navigation/` for:

- deriving bounded Space/Tab/Pane tree identities and selected ancestry;
- parsing, normalizing, serializing, and updating versioned browser preferences;
- sidebar width bounds, keyboard deltas, and collapse/restore behavior;
- mutually exclusive overlay transitions and focus-return intent.

The modules accept narrow workspace/tab/pane shapes instead of importing Collie's full
`HomeData`. Native components adapt current loader data into those functions. This preserves a
future Host-aware input/identity extension without activating or specifying Host rows now.

Alternatives rejected:

- Put preference and derivation logic under `web/src/lib`: broadens the upstream-owned port.
- Add a second `[[owned]]` block: `fleet-runtime` already owns `fleet/**`; extend its contract and
  verification list instead.
- Persist component-local JSON ad hoc: makes validation and bounds untestable.

### 3. Derive the hierarchy from the snapshot without side effects

The owned derivation joins workspaces, tabs, Agents, and shell panes by their existing ids while
preserving the snapshot's native ordering. It returns immutable rows plus the selected Pane's Space
and Tab identity. A root-shell effect only ensures that selected ancestry is included in local
disclosure state; disclosure buttons call the preference store directly and never navigate or
revalidate.

Space row activation uses `spacePath`, Pane activation uses `panePath` with the existing
`paneScope` rules, and both use `useNavigate`. Tabs are disclosure group rows because Collie has no
tab route; Pane activation remains the route-bearing operation. A selected Pane has
`aria-current="page"` and its ancestry is expanded before it is presented.

Alternatives rejected:

- Fetch children on disclosure: the snapshot already contains them and a request would create a
  second data path.
- Add a Tab route or query contract: expands Collie routing and changes existing Space behavior.
- Infer Hosts into the tree: first scope is explicitly single-host and must not claim Pack.

### 4. Reuse `AgentList` as the only Agent renderer

Add `NativeAgentRail` as a presentation wrapper around the existing `AgentList`, passing the root
Agents and the existing Pane-open callback. Desktop and responsive surfaces therefore inherit
favorite subscriptions, stable partitioning, triage, cards, accessible favorite controls, and
future compatible changes. The rail passes no shell panes and does not import or repurpose
`ThreadSidebar`.

If narrow sizing needs a presentation hook, extend `AgentList` only with a class/container port
that changes no list logic. Do not duplicate triage or favorite state in owned navigation modules.

### 5. Use one responsive shell state and two inactive mounted surfaces

At wide layout, CSS exposes left/sidebar, center/outlet, and right/sidebar regions. Below that
threshold, two localized toolbar triggers select one owned overlay state:
`"hierarchy" | "agents" | null`. Setting one state necessarily closes the other. The component
retains trigger refs, closes on Escape/backdrop/explicit close/navigation, and restores focus to the
opening trigger when available.

Inactive drawers/rails remain mounted only where persistence or exit handling benefits, but receive
both `inert` and `aria-hidden`; controls are not reachable while inactive. Desktop-collapsed
descendants use the same rule. Tailwind motion-reduction variants remove transforms and transition
durations.

Alternatives rejected:

- Two independent booleans: permits both overlays to be exposed simultaneously.
- Unmount every inactive surface: complicates focus restoration and makes accessibility state
  harder to verify.
- Reuse `BottomSheet`: the hierarchy drawer and side Agent overlay are navigation regions, not the
  app's bottom-sheet action surface.

### 6. Persist preferred widths, not transient rendered widths

Use one versioned local-storage record with separate left/right `{ preferredWidth, collapsed }`
values and bounded disclosed Space/Tab identity arrays. Pointer drag and separator keyboard
handling update only the addressed preferred width. Widths are normalized at every read and update;
collapse does not overwrite them, and restore re-clamps them against current constants.

The separator uses `role="separator"`, vertical orientation, `aria-valuemin/max/now`, a visible
focus mark, arrow increments, and Home/End bounds. Pointer movement is captured only for the active
drag. Storage is accessed behind an injected/catch-all adapter so disabled or throwing storage
falls back to the bounded in-memory snapshot.

### 7. Enumerate one invasive native-navigation port

Extend `fleet-runtime` contracts and verification with native navigation. Add one
`native-navigation-sidebars-port` invasive entry listing exact anchors for:

- `web/src/routes/root.tsx`;
- the new native shell/tree/rail component and focused test paths;
- any narrow `AgentList` presentation/test anchor actually required;
- all six typed dictionary keys;
- root/router-focused tests that prove persistent native outlet behavior.

No router, loader, API, service-worker, Gateway, bridge, `ThreadSidebar`, manual-fit, favorite-store,
or deployment path belongs in the entry unless implementation inspection proves a narrow port is
strictly necessary.

## Risks / Trade-offs

- **[A wide tree can starve the native route]** → Clamp both widths independently and collapse rails
  without discarding preferred widths.
- **[A selected Pane remains hidden by stored disclosure]** → Merge selected ancestry into effective
  disclosure whenever route identity changes.
- **[Storage corruption breaks application startup]** → Parse within strict byte/type/count/width
  bounds and fall back without throwing or fetching.
- **[Overlay focus is stranded]** → Centralize close reasons and restore the recorded trigger after
  the surface becomes inert.
- **[Two Agent implementations drift]** → Render `AgentList` directly; do not copy triage/cards.
- **[Shell remounts unnoticed]** → Add a root-router navigation test with a persistent shell probe.
- **[New components broaden the fork]** → Keep state owned and enumerate exact component/path anchors
  in one invasive manifest entry.

## Migration Plan

1. Add owned derivation, preference, resize, and overlay-state modules with focused pure tests.
2. Add native tree, Agent rail, and root shell components plus root/interaction/accessibility tests.
3. Add the root wrapper port, typed i18n, exact `FORK.toml` inventory, and concise Changelog entry.
4. During implementation run only focused owned/component/root/storage/accessibility tests and
   affected typecheck/lint/fork/OpenSpec checks.
5. At commit readiness run the full root and Web suites once with the pinned Bun, both typechecks,
   full lint, build, version/fork/OpenSpec/privacy gates, and staged-diff audit.
6. Push the exact candidate and deploy only that commit through the isolated staging workflow while
   preserving browser settings and unrelated services.
7. Roll back by deploying the previous exact staging commit; the browser-local record is ignored by
   builds without this shell and requires no server migration.
8. Archive only after owner browser acceptance.
