## 1. Boundary and baseline

- [x] 1.1 Re-read `AGENTS.md`, `DESIGN.md` §1/§2/§4/§6/§11, `FORK.toml`, the four spec deltas, and the other active change's artifacts; record this change's owned paths and verify no path it needs is one that change is editing
- [x] 1.2 Confirm `v3-dev` is level with its upstream and the working tree holds no other agent's edits to the paths below; verify with `git status --short --untracked-files=all` and the branch relationship
- [x] 1.3 Add the new fork-owned modules and components to `FORK.toml`'s owned entry, and extend the three existing invasive entries with this change's ports and reasons; verify `bun scripts/check-fork.ts` passes with no unattributed path

## 2. Command catalog and binding grammar

- [x] 2.1 Add the command catalog module with every id, English name, action scope and public default from the spec's table, expanding both ordinal families into independent ids; verify a test asserts each id appears exactly once, resolves to one adapter, and carries the exact declared default
- [x] 2.2 Add the binding parser and canonical label formatter covering direct chords, prefix bindings, `Tab`, `Shift+Tab`, `?`, digits and a modifier-bearing second chord; verify unit tests cover normalization plus every rejected shape, including the browser-reserved chords and exact-duplicate detection
- [x] 2.3 Add the fuzzy matcher used by both command bar modes, returning matched character positions; verify unit tests cover subsequence matching, ranking stability, and no-match

## 3. Recognizer and dispatch

- [x] 3.1 Implement the recognizer state machine over an injected clock — physical codes, exact modifiers, ignored pure modifiers and auto-repeat, bounded prefix expiry, and cancellation on `Escape`, focus-context loss and document hiding; verify tests cover `Shift`-before-key, `Tab`/`Shift+Tab`, timeout, blur, hidden document and extra modifiers
- [x] 3.2 Mount the recognizer behind one always-present capture-phase listener that prevents defaults synchronously and cancels the pending prefix on blur, document hiding and route change; verify a test proves an armed prefix takes `Escape`, `Tab` and the arrows ahead of the composer's own handler and releases them the moment the sequence ends
- [x] 3.3 Implement the availability-aware dispatcher shared by keys, the command bar, settings and other Fleet affordances; verify a test proves one adapter runs per invocation and an absent target changes no route
- [x] 3.4 Publish acknowledgements through the existing floating status with the shortcut/non-shortcut text rule, and suppress it where the route change is itself the outcome; verify tests cover both texts, the suppression case, and silence for rejected input

## 4. Shared roster

- [x] 4.1 Add `derivePaneRoster()` taking already-bucketed sections, shell Panes and the favorite predicate, and returning the sectioned view plus its flattening with the `shell` section last ordered by last-seen; verify pure tests cover section order, favorites-first inside every section including `shell`, empty-section removal, and the flattening's agreement with the sections
- [x] 4.2 Read the Agent rail's order from the roster at its single call site without restructuring the component, keeping shell rows out of the Agent surface; verify the rail's existing tests still pass unchanged
- [x] 4.3 Route `next-agent`, `previous-agent` and the nine Agent ordinals through the roster's flattening; verify a test proves the rail and the commands agree on order after a favorite change

## 5. Command bar

- [x] 5.1 Add the `FleetCommandBar` overlay as a top-anchored centred panel on the app's own tokens — `components/ui/` holds only the bottom sheet, which is the one presentation it must not reuse — with contained focus, `Escape` dismissal, focus restoration, and an outer size that does not change as results filter; verify tests cover dialog semantics and the fixed panel size across a wide and a narrow result set
- [x] 5.2 Implement command mode — the full catalog at `/`, English name plus every effective binding, explicit no-binding rows, matched-character marking, right-aligned binding labels, and activation through the shared dispatcher; verify tests cover browsing, filtering, an unbound row and activation
- [x] 5.3 Implement Pane mode — the invocation-time roster snapshot, section headings that are not selectable, fuzzy matching, and canonical navigation on activation; verify tests prove the list does not reorder, gain or lose a row while state lands, and that a vanished Pane fails closed
- [x] 5.4 Implement the shared selection behaviour: focus starts at the first row, up and down move it and keep it in view, a changed result set resets focus to the first row, `Enter` activates and an empty result set activates nothing; verify tests cover each case in both modes
- [x] 5.5 Wire `open-command-bar` and `open-pane-switcher` to the same overlay with the two initial queries, and support switching modes in place; verify a test proves both commands reach one surface

## 6. Structural and Pane commands

- [x] 6.1 Implement current-Space Tab targeting and current-Tab Pane targeting with wrapping, plus the whole-hierarchy Pane walk across every Host; verify tests cover wrapping, missing ordinals, one-Pane Tabs and multi-Host order
- [x] 6.2 Implement `last-pane` as a two-entry page-session history with swap-on-use and pruning of a Pane the topology has dropped; verify tests cover the toggle, a cross-Host pair and the pruned case
- [x] 6.3 Implement `create-tab` once behind its three aliases, deriving the current Space and session and opening the returned Pane canonically; verify a test proves all three aliases share one action id and one mutation
- [x] 6.4 Implement `copy-fleet-pane-link` from validated canonical route parts only; verify tests prove no credential is copied and an incomplete route leaves the clipboard untouched
- [x] 6.5 Route `rename-tab`, `rename-pane`, `close-tab` and `close-pane` into Collie's own actions surface for the current target, adding no second editor and no second mutation path; verify tests prove the surface opens on the right target and that no path uses a browser prompt or inline tree editing
- [x] 6.6 Keep the catalog free of Space rename and close, because the multiplexer exposes neither; verify the catalog test asserts their absence and the command bar offers no row that cannot land
- [x] 6.7 Preserve the safe-Home reconciliation when the displayed Pane is the one closed; verify a test covers closing the current Pane and closing another
- [x] 6.8 Bind `fit-pane-width` to the existing manual Pane fit path and `toggle-type-mode` to the composer's existing direct-typing lifecycle; verify tests prove one callback per invocation and the same armed state, focus and cleanup as the visible control
- [x] 6.9 Implement the eight fixed key commands as constant sequences through the existing authorised Pane key path; verify tests prove each sends exactly its declared array once, a caller-supplied sequence is refused, and a read-only Pane writes nothing

## 7. Sidebar collapse

- [x] 7.1 Implement `toggle-fleet-sidebars` with a bounded width and opacity transition, preserved content, scroll position, disclosure state and preferred widths, inert and hidden collapsed rails and separators, and no snapshot request or remote resize; verify tests cover collapse, restore, and the absence of a request
- [x] 7.2 Honour reduced motion by reaching the identical final state without animation, and make the command unavailable where the pair of rails does not exist; verify tests cover both

## 8. Settings document and Settings page

- [x] 8.1 Add the settings document's schema, defaults and whole-document validation as a pure module — unknown sections, unknown command ids, rejected binding shapes and duplicate bindings all failing the whole document with the offending entry named; verify unit tests cover each rejection and the absent-document default
- [x] 8.2 Add the modification-time-checked reader that holds the last good document and warns once per change of the file; verify tests cover a live edit, a malformed file and that no read fails because of one
- [x] 8.3 Add the atomic writer with the version guard, refusing a stale write and returning the current document; verify tests cover a successful replace, a stale write and that a rejected write leaves the file byte-identical
- [x] 8.4 Add the authenticated Gateway routes for reading and writing the document, accepting no client-supplied path; verify tests cover an unauthenticated read and write, and that `bridge/` is untouched
- [x] 8.5 Group every Fleet setting into one section at the head of the Settings page, each stating whether it applies to this browser or the whole installation, leaving Collie's own settings below unchanged; verify the Settings route's existing tests still pass and a new test asserts the group's position
- [x] 8.6 Add the binding editor as a validating JSON text area that names the offending entry on refusal, keeps the effective bindings in force, and reveals no filesystem path; verify tests cover a valid save, each rejection class and the absence of a path in the rendered output

## 9. Documentation, boundary audit and verification

- [x] 9.1 Document the catalog, the binding grammar, the prefix timing and cancellation rules, the two command bar modes and the settings document's contract in the public docs; verify a documentation test agrees with the executable ids and defaults
- [x] 9.2 Add one `CHANGELOG.md` line under `## [Unreleased]` and change no version file; verify `bash scripts/check-version.sh` prints its success mark
- [x] 9.3 Audit the whole task-owned diff for private deployment, device, domain, credential or parent-repository content, and for any binding that is an operator's own rather than a shipped default; verify the tracked tree contains only generic public-safe material
- [x] 9.4 Run the focused owned suites, both typechecks, lint over the touched paths, `bun scripts/check-fork.ts` and `openspec validate drive-the-fleet-from-the-keyboard --strict`; verify all pass
- [x] 9.5 Run the full root and web suites and `bun run build` once the feature is commit-ready; verify all pass, and confirm that any failure that remains fails identically on the unmodified tree
- [x] 9.6 Re-read every planning artifact against what was actually built and reconcile any drift before archive; verify the artifacts describe the implementation
