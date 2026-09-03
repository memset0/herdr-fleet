## Why

The exact Collie v1.2.0 baseline keeps its route content native but offers no persistent desktop
navigation shell for moving through the local Space → Tab → Pane hierarchy while retaining an
always-available Agent list. Reapply that Fleet navigation capability around Collie's existing
React Router outlet without restoring the retired iframe shell or introducing another data path.

## What Changes

- Add one persistent native root shell around the existing route outlet.
- On wide screens, show an independently resizable and collapsible local hierarchy sidebar on the
  left and a local Agent rail on the right that reuses the existing favorite-aware `AgentList`.
- On intermediate and mobile screens, expose the hierarchy and Agent list as mutually exclusive
  overlays while leaving every existing route surface native.
- Derive Space, Tab, and Pane rows from the root loader's existing snapshot, activate native Space
  and Pane routes with the current navigation helpers, highlight the selected Pane, and
  automatically disclose its Space and Tab ancestry without fetching.
- Store bounded, versioned browser-local width, collapse, and disclosure preferences with safe
  malformed, unavailable, and unwritable-storage behavior.
- Add keyboard-operable width separators, width clamps, collapse/restore behavior, inert and
  accessibility-hidden inactive descendants, focus restoration, and reduced-motion handling.
- Record the owned state/derivation boundary and the minimum exact Collie root/component/i18n ports
  in `FORK.toml`.

Non-goals:

- An iframe, `postMessage`, frame cache, duplicate router, alternate Gateway model, extra snapshot
  request, backend/API change, or mutation action.
- Create, rename, close, command, shortcut, Host-switching, Pack/trust, notification, ttyd, STT,
  release, deployment-mechanism, v2 edit, or v2 removal work.
- Redesigning Agent cards, favorites, manual Pane fit, composer behavior, mobile Tab/Pane strips,
  action sheets, or the Pane page's existing `ThreadSidebar`.
- Claiming Pack support. A future Host-aware extension may change the shell's data input and
  identity while preserving this native shell.

## Capabilities

### New Capabilities

- `fleet-native-navigation-sidebars`: Persistent native shell, local hierarchy and Agent surfaces,
  bounded browser preferences, responsive overlays, accessible resizing, and route-aware
  disclosure.

### Modified Capabilities

None. Collie's existing routes, loaders, router, Agent list/cards, favorites, Pane switcher, mobile
strips, actions, Gateway, and backend remain authoritative outside the narrow shell ports.

## Impact

- Adds fork-owned navigation derivation, preference, and interaction state under
  `fleet/ui/native-navigation/`.
- Adds narrow native shell/tree/rail components and a root-route wrapper port under `web/src/`.
- Adds typed labels to all six existing i18n dictionaries plus focused owned/component/root tests.
- Updates `FORK.toml` and `CHANGELOG.md`.
- Adds no dependency, route, loader, API call, mutation, backend state, configuration field, or
  release.
