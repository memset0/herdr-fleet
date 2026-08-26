# Changelog

All notable changes to Herdr Web Remote and its Collie-derived node UI are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and the project uses
[Semantic Versioning](https://semver.org/). The newest `## [x.y.z]` heading **must** match the
`version` in `herdr-plugin.toml`, `package.json`, and `web/package.json` (enforced by
`scripts/check-version.sh`). See [`CLAUDE.md`](./CLAUDE.md) → *Versioning* for the bump policy.

## Unreleased — Codex slash-command guard

### Fixed

- Recognize Codex's exact tail slash palette as a writable command state only when the complete
  `/command` query matches the first cyan/bold selected option. Guarded replies can now execute
  `/status`, `/fast`, and other exact slash commands after two stable reads; partial filters,
  renderer-free lookalikes, mismatched selections, dialogs, and output below the palette still
  withhold Enter.
- Mark only framed Collie documents before React mounts and use root-scoped static CSS plus exact
  data hooks to hide the redundant `Switch pane` trigger/hit area and `Controls` label reservation
  inside Fleet. The switch sheet and every composer action remain implemented, while top-level
  Collie retains the complete trigger, label, spacing, gestures, keyboard, and accessibility.

## [2.7.3] - 2026-08-26

### Fixed

- Hide Codex's native composer only when it is positively located and empty, including its exact
  dim placeholder; the same non-dim words remain a real draft. Preserve non-empty drafts and their
  blank layout rows, while keeping trust/approval/question dialogs visible in the raw mirror
  alongside the structured controls.
- Treat Codex's official exact `[Pasted Content N chars]` token as supplemental composer evidence
  only when `N` equals this send's Unicode character count; mismatches and surrounding text remain
  rejected.
- Split Codex input into Unicode-safe sub-1,024-byte writes with a bounded inter-chunk settle, after
  a live Herdr 0.8.0 probe showed one larger `pane.send_text` retained exactly its first 1,024
  bytes. A later chunk failure is reported as partial delivery and never submits or retries.
- Extend Codex's read-only verification window without retyping, require two consecutive identical
  verified prompt/draft tails, and bind the final Enter to that stable region. This rejects a repaint
  or dialog race without refusing a long draft whose first `›` row wrapped above the bridge's tail
  window (7edc779).

### Upgrading

- Install this guarded-submit patch on every v2.7.x node whose Codex page accepts remote replies.
  It changes no configuration or public API and retains v2.7.2 as the immediate rollback.

## [2.7.2] - 2026-08-26

### Fixed

- Remove exactly Codex's final status/footer row from the terminal mirror and preserve every native
  input-box row above it, including ANSI-empty separator/layout rows. The visible `›` prompt and
  draft now retain the same vertical shape as the TUI instead of losing one extra blank line.

### Upgrading

- Install this presentation patch on every node running v2.7.1. It changes no parser, API,
  configuration, or runtime boundary; retain v2.7.1 as the immediate rollback.

## [2.7.1] - 2026-08-26

### Fixed

- Support the compact two-field status renderer only when its four ANSI segments match Codex's
  strict indent/coloured-field/dim-separator/coloured-field signature; the same two-field text
  without renderer evidence remains rejected.
- Recover half-written drafts while Codex is working and replaces its summary with the official
  `tab to queue message` footer, including the bounded blank composer height. Ask/question/notes
  footers remain dialog-owned and composer-unready.
- Taking over such a working draft clears the terminal composer with a prompt-bound
  `ctrl+k`/Backspace sweep before retyping, verifies the replacement, and queues exactly once rather
  than appending or duplicating the recovered text.
- Keep Codex's native `›` input box and draft visible in the terminal mirror for diagnosis; remove
  only the trailing status/queue-footer row and continue re-surfacing that row in the app status
  strip. Dialog cards retain their existing native controls.

The queue fixture is synthetic from official Codex TUI snapshots and was structurally validated
against a disposable local Codex 0.149.1 Pane; no live Pane/session/device content is retained.

### Upgrading

- Install this final adapter patch on every node that received v2.7.0. It is configuration/API
  compatible and preserves each node's v2.7.0 tree as the immediate rollback.

## [2.7.0] - 2026-08-26

### Fixed

- Recognize a normal tail Codex composer when its bounded, multi-field customized status row omits
  the default `Context N% left/used` field. Guarded replies once again type, verify the visible
  draft, and submit exactly once instead of permanently reporting that the message did not reach
  the input box.
- Keep disabled, missing, malformed, torn, overlong, transcript-lookalike, and dialog-owned status
  regions fail-closed. The fix changes only Codex status-row evidence and does not weaken the
  existing type-before-submit or dialog race guards.

The fixture is wholly synthetic and contains no live Pane/session/device data.

### Upgrading

- This node-affecting minor release must be installed on the central Fleet host and every managed
  Collie node. The rollout replaces only Web Remote-owned supervisor/bridge/Gateway children and
  leaves Herdr, Panes, live config, reverse proxies, transports, notifications, and fallback state
  unchanged.
- Preserve v2.6.0 on each node as the immediate rollback. No configuration or API migration is
  required.

## [2.6.0] - 2026-08-26

### Added

- Merge the exact Collie v0.34.0 release commit as Git ancestry and adopt its guarded plan-feedback,
  password/no-echo, complete/partial draft, direct-typing cancellation, and socket-drain behavior.
- Add first-class Codex and Grok Build composer, dialog, status, and journal harnesses; retain the
  OMP inline-suggestion and tall Codex prompt fixes with byte-faithful fixtures.
- Add hot-reloaded operator `commands.toml` and `keys.toml`, F1–F12, tap-to-type preference,
  optional audit-content redaction, sanitized OSC terminal titles, and Push subscription upkeep.
- Keep up to four dated, per-session Pane mirrors in `sessionStorage` for transport-only recovery;
  password prompts are excluded and a definitive 401/403 clears every persisted Collie mirror.

### Preserved boundaries

- Keep Web Remote's product identity, Gateway, plugin-owned supervisor, ttyd fallback companion,
  manual Pane resize, exact Host/Origin policy, framed seen-attribution, Fleet actions/shortcuts, and
  no-central-Pane-content projection.
- Do not adopt Collie's service/Tailscale/QR lifecycle, `collie-ctl.sh`, `COLLIE_PUBLIC_URL`,
  `COLLIE_SERVE_PORT`, or moving self-update/major-update behavior.

### Upgrading

- This node-affecting minor release must replace the Web Remote plugin on the central Fleet host and
  every managed Collie node. The hot switch replaces only plugin-owned supervisor/bridge/Gateway
  children; it does not restart Herdr, terminate Panes, activate ttyd fallback, or change live
  routing and credentials.
- Existing Web Remote configuration remains valid. The new `commands.toml`, `keys.toml`, Grok
  transcript root, and audit-content policy are optional and default to the prior behavior.

## [2.5.19] - 2026-08-24

### Added

- Auto-open the left Host tree's disclosure chain to the currently selected Pane on every render so the selected row is always visible without operator action (fleet-highlight-current-pane-in-rails).
- Paint the right Agent card whose `(node, pane, session)` matches the current Fleet route with a distinct `data-current-pane="true"` ring so the operator can pivot between the two rails without losing track of the center Pane (fleet-highlight-current-pane-in-rails).

### Changed

- Introduce `--fleet-selected-foreground` and use it for the left Host tree's selected row text in both desktop and mobile surfaces, so the selected row reads at a glance against the accent background (fleet-highlight-current-pane-in-rails).

### Upgrading

- Minor release. Update the central Fleet Web bundle to `2.5.19` for the auto-disclose / selected-foreground / current-pane ring treatment. Remote nodes may continue on any `2.5.x`; the new visual treatment is additive and renders only inside the Fleet iframe shell.

## [2.5.18] - 2026-08-24

### Added

- Register two new desktop Fleet shortcuts `Alt+H` ("Previous Agent") and `Alt+L` ("Next Agent") that walk the right Agent menu's current rendered order, with each press resolving its target against the `agentShortcutTargets` snapshot at the moment of the press and falling back to the first/last Agent when the current selection is not in the snapshot (fleet-alt-h-l-cycle-agent).

### Upgrading

- Minor release. Update the central Fleet Web bundle to `2.5.18` for the new `Alt+H` / `Alt+L` cycle bindings. Remote nodes may continue on any `2.5.x`; the new bindings are additive and only fire when both the binding and the Fleet iframe shell are present.

## [2.5.17] - 2026-08-24

### Fixed

- Render the desktop Agent card ordinal as a small circular numeric badge on the avatar's bottom-left instead of an inline `Alt+N` keycap next to the favorite button, so the shortcut position is legible without spending extra card width and the title row stays balanced. Bump the desktop meta row's right inset from `.5rem` to `.75rem` so the bottom row text sits visibly further from the card's right edge than the favorite button does (fleet-agent-ordinal-badge).

### Upgrading

- Update the central Fleet Web bundle to `2.5.17` for the avatar ordinal badge and the bumped meta row right inset. The patch remains compatible with `2.5.x`, changes no Herdr/Gateway protocol or configuration, and needs only the existing plugin-owned hot switch. Remote nodes may continue on any `2.5.x`.

## [2.5.16] - 2026-08-24

### Fixed

- Give the Fleet agent card meta row (Host chip + last-active timestamp) the same horizontal right inset as the favorite button on the card's top row, so the bottom-row text no longer runs flush against the card's right edge and visually aligns with the favorite button instead.

### Upgrading

- Update the central Fleet Web bundle to `2.5.16` for the aligned Fleet agent card meta row. The patch remains compatible with `2.5.x`, changes no Herdr/Gateway protocol or configuration, and needs only the existing plugin-owned hot switch. Remote nodes may continue on any `2.5.x`.

## [2.5.15] - 2026-08-24

### Fixed

- Drop the global right-side reservation from the Fleet agent card so the bottom meta row (Host chip and last-active timestamp) now reaches the card's true right edge on both desktop and phone-width surfaces; keep only the title row reserved for the favorite button and desktop keyboard-shortcut hint (fleet-agent-card-right-edge).
- Pin the desktop Fleet left rail footer (version + settings) to the bottom edge when the Host tree is shorter than the available rail height, by giving `.instance-strip` `flex: 1; min-height: 0;` inside the `min-width: 1200px` media query (fleet-agent-card-right-edge).

### Upgrading

- Update the central Fleet Web bundle to `2.5.15` for the corrected agent-card alignment and the pinned left-rail footer. The patch remains compatible with `2.5.x`, changes no Herdr/Gateway protocol or configuration, and needs only the existing plugin-owned hot switch. Remote nodes may continue on any `2.5.x`.

## [2.5.14] - 2026-08-23

### Added

- Show a bottom-centre fading `<key> · <action>` confirmation whenever desktop Fleet accepts a supported exact shortcut from either the outer document or selected iframe (be63014).

### Fixed

- Close the iframe document-load/React Pane-mount race by capturing delivered shortcuts and waiting one bounded interval for the existing Resize handler, while preserving one command and one API invocation with no retry (be63014).
- Keep the first nine Agent hints to a single `Alt+N` keycap and reserve its extra width on the title row so Host/age metadata returns to its original lower-right alignment (be63014).

### Upgrading

- Update central Fleet and each node Web bundle to `2.5.14` for immediate iframe `Alt+S` reliability and consistent shortcut feedback. The patch remains compatible with `2.5.x`, changes no Herdr/Gateway protocol or configuration, and needs only the existing plugin-owned hot switch.

## [2.5.13] - 2026-08-23

### Added

- Add a single discoverable desktop Fleet shortcut registry for `Alt+S`, `Alt+K/J`, and `Alt+1…9`, including exact physical-code/modifier matching, left-tree Pane cycling, and first-nine Agent card badges in current rendered order (5f13b20).
- Add a strict versioned selected-iframe bridge that forwards registered shortcut ids only and delegates `Alt+S` to the exact existing Collie Display Resize callback without exposing raw keys or adding an HTTP/CORS surface (5f13b20).

### Fixed

- Rebuild shortcut targets and hints atomically across live Agent reorder and desktop/compact breakpoint changes, while keeping hidden cached frames and standalone Collie inactive (5f13b20).

### Upgrading

- Central `2.5.13` remains compatible with older `2.5.x` nodes and immediately provides outer-focus navigation. Update each node Web bundle to `2.5.13` to enable shortcuts while focus is inside that iframe and to enable Fleet `Alt+S`; no Herdr restart, protocol migration, or new service is required.

## [2.5.12] - 2026-08-23

### Fixed

- Preserve keyboard focus on the same Agent favorite control when an already in-flight Fleet refresh rerenders the list after a favorite reorder, without stealing focus back after the operator has moved elsewhere (068816d).

### Upgrading

- This is a central-only Fleet accessibility patch following 2.5.11. Upgrade the central Gateway plugin to `2.5.12`; remote `2.5.x` nodes remain compatible.

## [2.5.11] - 2026-08-23

### Added

- Add an upper-right Collie/Lucide favorite star to every Agent card in the desktop rail and compact/mobile overlay, with accessible pressed state, focus restoration, and no navigation or refresh side effect (04a5578).
- Persist a bounded browser-local favorite Set keyed by exact Host, Herdr session, Pane, and Agent implementation; malformed/unavailable storage falls back to in-memory state and never creates a Gateway or Collie write (04a5578).

### Changed

- Sort favorites before ordinary cards inside each existing Agent status section while preserving the original last-activity/last-seen ordering within both partitions and leaving group membership/counts unchanged (04a5578).

### Upgrading

- This is a central-only Fleet presentation patch. Upgrade the central Gateway plugin to `2.5.11`; compatible remote `2.5.x` nodes do not need to be reinstalled or restarted.

## [2.5.10] - 2026-08-23

### Changed

- Slide/fade the independent compact Host drawer and footer, and animate stable keyed Host/Space/Tab child groups through bounded grid-track and opacity transitions without rebuilding the AppBar switcher (fe7fbd8).
- Replace font-dependent text arrows with Collie's standard Lucide `ChevronRight`, using the same centred `.5rem` leading slot as direct Pane status dots so sibling labels align exactly (fe7fbd8).
- Make collapsed drawer/groups immediately inert and accessibility-hidden, and disable every new drawer/group/chevron transition when reduced motion is requested (fe7fbd8).

### Upgrading

- This is a central-only Fleet presentation patch. Upgrade the central Gateway plugin to `2.5.10`; compatible remote `2.5.x` nodes do not need to be reinstalled or restarted.

## [2.5.9] - 2026-08-22

### Fixed

- Export the no-bytecode policy from the fallback CLI so activation-scoped Python children, including the local relay that imports `node.py`, also leave an exact Git checkout clean across enable/status/disable (1ea9b02).

## [2.5.8] - 2026-08-22

### Fixed

- Run the fallback controller with Python bytecode writes disabled so an activation from an exact Git checkout cannot create `__pycache__` and trip the adapter's clean-release guard on the next lifecycle command (252620c).

## [2.5.7] - 2026-08-22

### Fixed

- Separate the compact AppBar's Host-only switcher from the hierarchical Host tree so opening the `H` drawer no longer removes a shared element from AppBar flow, shifts its sibling actions, or resets horizontal Host scrolling (9ae8b07).
- Give compact Host buttons an explicit Collie-styled gap and scope drawer-only full-width row styling to the tree container, preserving identical AppBar bounds and button identity across drawer disclosure (9ae8b07).

### Upgrading

- This is a central-only Fleet presentation patch. Upgrade the central Gateway plugin to `2.5.7`; compatible remote `2.5.x` nodes do not need to be reinstalled or restarted.

## [2.5.6] - 2026-08-22

### Changed

- Move fallback navigation from separate per-node TLS hostnames to canonical paths on the existing Fleet origin: `https://<fleet-host>/ttyd/<node-id>/` (2c2fcf3).
- Accept only each inventory node's exact Fleet-origin path, keep the desktop link navigation-only, and retain compact/phone/tablet DOM omission (2c2fcf3).

### Security

- Replace same-origin HTTP Basic with activation-scoped local verification of the existing signed Fleet session cookie; the helper uses protected Gateway configuration without calling Gateway and never puts cookie/signing material in argv, state, URLs, node payloads, or diagnostics (2c2fcf3).
- Strip `Authorization`, forged trusted identity, and the Fleet cookie before ttyd; require exact Fleet Host, node path, Origin, deadline, and one-client boundaries. Shared synthetic vectors keep Python verification aligned with Gateway's TypeScript HMAC contract (2c2fcf3).

### Upgrading

- Add the companion's nested active-fragment import and permanent closed `/ttyd/*` 404 before the normal Gateway proxy, then change `fallbackUrl` values and companion inventory together. Closed links retain valid Fleet TLS and start nothing.
- This patch does not change the Collie protocol, Herdr attachment, or existing local/direct-SSH/jump transport contracts. Reinstall managed companion payloads for exact-release consistency before live activation.

## [2.5.5] - 2026-08-22

### Fixed

- Replace Fleet's hand-authored settings gear with the exact standard Lucide `Settings` geometry already selected by Collie's UI library, keeping the outer outline and inner circle aligned on the same centre without changing the button or popup behavior (3fecfbd).

### Upgrading

- This is a central-only Fleet presentation patch. Upgrade the central Gateway plugin to `2.5.5`; compatible remote `2.5.x` nodes do not need to be reinstalled or restarted.

## [2.5.4] - 2026-08-22

### Security

- Reject a mismatched HTTP Host explicitly inside every generated fallback route before authentication or proxying, instead of relying only on the Caddy site label under every ingress/protocol combination (93dd754).
- Cover the exact Host matcher/response in the companion contract test and validate the generated fragment through the installed Caddyfile adapter (93dd754).

### Upgrading

- Upgrade the trusted ingress/controller to `2.5.4` before the next activation. Node payload protocol and normal Collie/Gateway behavior are unchanged.

## [2.5.3] - 2026-08-22

### Fixed

- Allow an explicitly managed split-host build to defer the ttyd companion suite to its activation gate, while keeping the suite mandatory by default and rejecting every unknown test mode (513b9a1).
- Document that a deferred build is valid only when the exact prepared release runs the companion suite with a compatible Python before replacing the live plugin (513b9a1).

### Upgrading

- Upgrade a repo-less split-host rollout to `2.5.3`: the build host performs the normal frozen Web
  Remote build and backend tests, then the runtime host runs the exact companion suite with its
  existing Python 3.12 before the atomic plugin switch. Runtime behavior remains unchanged.

## [2.5.2] - 2026-08-22

### Fixed

- Isolate the synthetic central-runtime ownership operation and resolve the effective group independently of the username in the successful activation unit test, so the companion security suite runs on rootless managed nodes without attempting a real `chown(root, caddy)` (255b17a).

### Upgrading

- Upgrade `2.5.1` release checkouts to `2.5.2` before rootless node rollout. Runtime behavior and the dormant/activation security topology are unchanged.

## [2.5.1] - 2026-08-22

### Fixed

- Run the companion installer's strict inventory import with Python bytecode generation disabled, so installing from an exact Web Remote checkout cannot dirty that checkout and block the next exact-release lifecycle command (6f81e30).
- Let the companion test runner use an explicitly selected compatible Python for older Linux hosts, and exercise the installer with `PYTHONDONTWRITEBYTECODE` removed while requiring that no service-local `__pycache__` is created (6f81e30).

### Upgrading

- Upgrade `2.5.0` deployments to `2.5.1` before preparing or activating the ttyd companion. The normal Collie/Gateway protocol and fallback security topology are unchanged; installation remains dormant.

## [2.5.0] - 2026-08-20

### Added

- Ship a normally dormant ttyd emergency-terminal companion inside the existing `memset0.web-remote` release, with a pinned/verified Linux binary installer, fixed client-only Herdr attachment, explicit bounded lifecycle CLI, synthetic inventory, public documentation, and security/integration tests (c9d0119).
- Accept a validated per-node HTTPS `fallbackUrl` and create a secondary emergency-terminal link only in the desktop-computer Fleet presentation; compact, phone, tablet, and coarse-pointer DOMs do not receive the entry, and render/hover never probes or activates the route (c9d0119).

### Security

- Keep the fallback outside the Collie/Gateway data path while retaining independent activation-scoped authentication, exact Host/Origin and trusted-header checks, one writable client, owner/host/job gates, dedicated restricted SSH transport, a 30-second to two-hour lease, transactional cleanup, and no browser-selected command or terminal (c9d0119).
- Keep one Herdr plugin identity, manifest, supervisor, and release stream. Normal registration, startup, events, `ensure`, and updates start no ttyd process, broker, auth helper, route, transport, service, timer, hook, or fallback supervisor (c9d0119).

### Upgrading

- This is a node-affecting minor release. Upgrade the central Gateway/Fleet plugin to `2.5.0` first, then update every managed node bundle to `2.5.0` so its dormant companion payload comes from the same exact release. Add `fallbackUrl` only after the central validator is upgraded.
- Activation remains a separate trusted-operator command and does not restart Herdr or terminate Panes. Retain the prior closed payload and forced-command authorization as inert rollback material until per-node activation and cleanup acceptance passes.

## [2.4.3] - 2026-08-20

### Added

- Show the running Web Remote version and browser-local iframe-cache settings footer at the bottom of the open compact Host drawer, with the same bounded upward popup used by the desktop rail (88d4740).
- Keep reachable Host and Space `+` actions touch-visible in the compact tree so phone users can create a Space or Tab through the existing exact-child action contract (88d4740).

### Fixed

- Reserve the compact drawer footer and safe-area height from the independently scrolling Host tree, and dismiss the settings popup consistently on outside pointer, Escape, or drawer close (88d4740).
- Route successful compact create actions through the shared tree selection path so the fresh Pane opens without leaving the overlay active (88d4740).

### Upgrading

- This is a central-only Gateway patch. Upgrade the central plugin to `2.4.3`; remote `2.4.x` Collie nodes remain compatible and do not need to be reinstalled or restarted.

## [2.4.2] - 2026-08-20

### Changed

- Redesign the script-free Gateway login as a compact Herdr Web Remote sign-in surface with explicit labels, neutral light/dark styling, visible focus, safe-area spacing, touch-friendly controls, and semantic generic failure alerts (762facf).
- Compose both Gateway login and Fleet stylesheets from the same Collie-aligned token and focus foundation while preserving Fleet's existing layout, status colors, and behavior (762facf).

### Fixed

- Revalidate the unversioned `/auth/app.css` response so a rollout cannot pair new login markup with a stale one-hour stylesheet, while preserving its public route and security headers (762facf).

### Upgrading

- This is a central-only Gateway patch. Upgrade the central plugin to `2.4.2`; remote `2.4.x` Collie nodes remain compatible and do not need to be reinstalled or restarted.

## [2.4.1] - 2026-08-20

### Added

- Add a desktop Host-rail footer with the running version and a browser-local iframe-cache capacity setting that applies immediately while preserving the selected frame, existing LRU order, and 30-minute quiet cleanup (17a950e).
- Add separate reachable-row actions for creating a Space on a Host's primary session and creating a Tab with a fresh Pane in an exact Space/session, then open the returned Pane without changing disclosure state (17a950e).
- Add context-menu and keyboard rename editing for Tabs and explicit Panes, including flattened one-Pane Tab rows and Collie's existing blank Pane-label clearing behavior (17a950e).

### Security

- Delegate only four bounded structural actions through an exact-parent child contract with strict schemas, source/origin/request correlation, de-duplication, bounded timeouts, and no automatic mutation retry; no node HTTP route or cross-origin Gateway write proxy is added (17a950e).

### Upgrading

- Upgrade the central Gateway/Fleet plugin to `2.4.1`, then update managed Collie node bundles to enable the quick actions. Older `2.4.x` nodes remain fully navigable and fail the optional action handshake safely; no configuration or data migration is required.
- The cache override is stored only in each browser. Removing it with **Use default** restores the existing `fleetUi.iframeCacheSize` value.

## [2.4.0] - 2026-08-20

### Added

- Add a bounded, versioned Fleet-to-Collie activity message sent only to each resident iframe's exact configured origin; framed Collie accepts activity only from its exact parent window and fails closed before the first valid message (bba81e6).
- Revalidate the current Pane once when a cached frame becomes the selected, unobscured frame in a visible Fleet document, without adding another timer or recreating the iframe (bba81e6).

### Fixed

- Prevent hidden cached iframes, background Fleet tabs, and compact overlays from advancing a Pane's shared seen timestamp: inactive Pane and History reads now omit `x-collie-seen`, while standalone Collie and authenticated write actions retain their existing behavior (bba81e6).

### Security

- Keep the node's existing `lastSeenAt` as the single authority for Collie, Fleet, and Discord; the activity protocol carries only one boolean, adds no browser/Fleet persistence, and preserves Gateway CSP, exact route validation, cache LRU, quiet cleanup, idle lock, and PTY boundaries (bba81e6).

### Upgrading

- This is a node-affecting minor release. Upgrade the central Gateway/Fleet plugin to `2.4.0` first, then reinstall or update every managed Collie node bundle to `2.4.0`; no configuration or data migration is required.
- Activation replaces only Web Remote's plugin-owned supervisor generation and children. It does not restart Herdr or terminate Panes. Roll back both layers to `2.3.1` if mixed-version verification fails.

## [2.3.1] - 2026-08-18

### Added

- Reuse the Collie-styled Host tree as a compact/mobile drawer opened from the AppBar `H`, while preserving the same expansion state, resident iframe, and wide-screen three-column layout (2d4002d).
- Flatten Tabs with exactly one valid Pane into direct level-three destinations that display the Pane's Agent or `shell` state; multi-Pane Tabs remain expandable (2d4002d).

### Fixed

- Restore Host-row navigation to the Host home document while keeping its dedicated chevron as the hierarchy disclosure control (2d4002d).
- After opening a live `Ready unseen` or `Needs You` Agent card, request an immediate Fleet refresh through the existing bounded manual-reset path, preserving its five-second floor and single queued retry (2d4002d).

### Upgrading

- This is a central-only Fleet patch. Upgrade the central Gateway plugin to `2.3.1`; remote Collie nodes may remain on `2.3.0`, and no configuration changes or node reinstall are required.

## [2.3.0] - 2026-08-18

### Added

- Add a visibly `Custom` manual Resize action directly below Text size in Collie's Pane display settings. A click measures the current terminal scrollport with the selected monospace font and resizes only that Pane's column count; window changes never resize automatically (d12a4dd).
- Retain and reuse one non-takeover Herdr terminal controller per resized Pane, preserving the Pane's current viewport row count while applying the requested width (d12a4dd).

### Security

- Reuse the existing write Origin/Host, device-authorization, session, and audit gates for resize requests; viewport rows remain bridge-only and are never exposed in the browser snapshot (d12a4dd).

### Upgrading

- This is a node-affecting minor release. Upgrade the central Gateway plugin and every managed Fleet node to `2.3.0`; no configuration changes are required.
- Activation replaces only Web Remote's plugin-owned supervisor generation and children. It does not restart Herdr or terminate Panes. Restarting the bridge releases any active manual-resize controller, so Herdr may restore its desktop-owned layout until Resize is clicked again.

## [2.2.2] - 2026-08-18

### Fixed

- Repair the desktop Host rail's vertical layout, remove the redundant visible `Hosts` and `FLEET / All Agents` headings, keep the selected-node new-tab action at the Host rail's top right, and move the canonical refresh state to the bottom of the Agent rail (0244be3).
- Make Host, Space, and Tab rows disclosure-only on desktop so only Pane rows switch the selected Collie document (0244be3).

### Added

- Let pointer and keyboard users resize both desktop rails, remember bounded browser-local preferences, and clamp them after viewport changes while preserving at least 40rem for the native Collie iframe (0244be3).

### Security

- Resizing changes only parent-grid CSS variables and temporarily shields cross-origin iframe pointer capture; it never recreates, reloads, or rewrites a resident frame, so Collie navigation after initial admission remains attached to that exact cached document (0244be3).

### Upgrading

- This patch changes only the central Fleet shell. Upgrade the central Gateway plugin to `2.2.2`; remote node bundles may remain on `2.2.0`, and existing `fleetUi.iframeCacheSize` configuration remains valid.

## [2.2.1] - 2026-08-18

### Added

- Wide Fleet windows now use a Collie-styled, collapsible `Host → Space → Tab → Pane` rail, the unchanged native Collie iframe as a full-height centre, and the existing `FLEET / All Agents` component as a persistent right rail; phone behavior remains compact and intermediate windows are no longer capped at 640 px (ad83984).
- The tree reuses each existing Agent snapshot response without topology traversal or extra remote requests, retains expansion across refreshes, shows Host health and each Pane's Agent status or `shell`, and keeps failed-session topology visibly stale until authoritative recovery (ad83984).
- Optional `fleetUi.iframeCacheSize` accepts 1–10 and defaults to one; visited Host documents are retained lazily with foreground-visit LRU eviction, exact per-frame route/origin isolation, and a 30-minute silent cleanup of every non-selected iframe (ad83984).

### Security

- Fleet continues projecting only bounded identifiers, safe labels, status, and routing metadata for the hierarchy; Pane output, history, credentials, device state, update state, and unknown snapshot fields remain excluded (ad83984).
- Cached frames remain exact-origin authenticated Collie documents. The selected frame is never evicted, Agent state never affects cache priority, and the parent neither inspects iframe content nor invokes or changes Collie's idle lock (ad83984).

### Upgrading

- This patch is central-compatible: upgrade only the central Gateway plugin to `2.2.1`; remote node bundles may remain on `2.2.0` because their existing snapshot and route-report surfaces already provide the required data.
- Existing config preserves one resident iframe. To opt in to five, add `"fleetUi": { "iframeCacheSize": 5 }` to the owner-only central `gateway.json`; activation replaces only Web Remote's plugin-owned children and does not restart Herdr or terminate Panes.

## [2.2.0] - 2026-08-16

### Added

- Adopt Collie v0.28.0 at exact upstream commit `2910f40278f3ca1646fc472dd3589da4a47776e4`, including ordered direct terminal typing, harness-neutral dialog guards, the Tier-1 `omp` adapter and slash palette, GFM history tables, and bundled lazy Nerd Font symbols.
- Allow every transcript-root setting to name multiple comma-separated roots while keeping each selected session realpath-contained within the root where it was found.

### Fixed

- Bind destructive pre-clear and reply submission to a fresh visible composer read, including narrow panes, wrapped CJK drafts, and Claude paste placeholders, so a dialog transition cannot receive stale text or an unverified submit key.
- Restore valid Apple update-push topics, retire repeatedly failing push subscriptions safely, prevent idle session-name polling from scrolling panes, and preserve sign-in classification behind redirecting identity proxies.

### Security

- Preserve Web Remote's authenticated Gateway, exact Host/Origin and frame policy, network-first navigation, loopback listeners, transcript containment, zero-central-secret remote nodes, and plugin-owned supervisor lifecycle across the upstream merge.
- Continue excluding upstream Tailscale publication, systemd/launchd/Windows lifecycle, QR tooling, and moving self-update behavior.

### Upgrading

- This is a node-affecting minor release. Upgrade the central Gateway plugin and every managed Fleet node to `2.2.0`; existing configuration remains valid, while the new comma-separated transcript roots are optional.
- Activation replaces only each node's Web Remote supervisor generation and children. It does not restart Herdr, terminate Pane processes, or install an operating-system service.

## [2.1.14] - 2026-08-16

### Fixed

- Every Fleet Agent alert now passes its normalized readable inventory Host through `pingme send --host`, so the default runtime footer identifies the machine that owns the Agent instead of the central Gateway process (02dfaf4)
- Missing readable Host names fall back to the stable inventory id without adding a system user, while existing custom-template Host variables and the Space/Tab/Pane webhook username remain unchanged (02dfaf4)

### Upgrading

- Upgrade the central Fleet host's local `pingme` executable to a revision with `send --host <LABEL>` support before activating this patch. Remote `2.1.x` node bridges remain compatible and may defer updating.

## [2.1.13] - 2026-08-16

### Fixed

- Unreachable cached Agent cards now preserve pending confirmation deadlines and the last authoritative attention group, so recovery resumes the same episode instead of losing or duplicating it (28fec41)
- Suspended offline candidates no longer pull the shared collector toward an expired deadline, preserving its adaptive backoff while the existing schedule discovers recovery (28fec41)
- The Gateway now allows one `pingme` child up to 120 seconds to finish its own bounded Discord operation and logs only a sanitized failure class, without automatic redelivery after an ambiguous timeout (28fec41)

### Upgrading

- This central notification patch remains wire-compatible with `2.1.x` node bridges, so remote nodes may defer updating and do not need a restart.

## [2.1.12] - 2026-08-15

### Fixed

- Pending Ready and Needs You notifications now survive passive Recent, idle, unknown, and attention-group changes until their original ten-second deadline, preventing Pane views from silently discarding an alert (202dcba)
- Only an authoritative Working/Running observation cancels an attention candidate as handled; offline projection, removal, and identity replacement retain their existing stale-delivery safeguards (202dcba)
- A candidate that changes attention groups keeps its original deadline and delivers with the latest Ready/Needs You status and avatar while using the newest card's exact route context (202dcba)

### Upgrading

- This central notification patch remains wire-compatible with `2.1.x` node bridges, so remote nodes may defer updating and do not need a restart.

## [2.1.11] - 2026-08-15

### Fixed

- Canonical notification, Agent-menu, iframe-report, and clipboard links now retain explicit validated Host-instance, Space, Tab, and Pane route identity so sibling Panes in one Tab cannot lose their distinguishing context (be95e58)
- The central iframe shell derives or preserves Space/Tab identity for compatible older node reports and rejects partial pairs instead of silently stripping complete outer-link context (be95e58)

### Security

- Complete route links contain only public inventory/Herdr route selectors and never add a coding-agent session or Thread identifier (be95e58)

### Upgrading

- Central deployment fixes new notification links immediately. Remote nodes remain compatible; updating them later lets their iframe route reporter provide Space/Tab directly.

## [2.1.10] - 2026-08-15

### Changed

- Default-template alerts map readable Space and Tab names to `pingme` project and session-title metadata so the shared trailing footer can replace a Fleet-specific template while Pane remains in the webhook username (4459edd)

### Security

- Internal-id-only Tabs and every coding-agent session/thread identifier remain absent from default footer metadata (4459edd)

### Upgrading

- This central presentation patch remains wire-compatible with `2.1.x` node bridges, so remote nodes may defer updating and do not need a restart.

## [2.1.9] - 2026-08-15

### Fixed

- Discord webhook usernames retain the full `Space · Tab · Pane` hierarchy when a Pane has no explicit label by using Collie's existing human-readable Agent-name fallback instead of dropping the Pane level (0aaab95)

### Upgrading

- This central presentation patch remains wire-compatible with `2.1.x` node bridges, so remote nodes may defer updating and do not need a restart.

## [2.1.8] - 2026-08-15

### Added

- Confirmed Ready and Needs You alerts now make one bounded, non-seen History read and put only the newest Assistant text before the canonical Fleet Pane link, with link-only fallback for unavailable or incompatible nodes (2bac34c)
- Discord deliveries override the webhook username with the bounded readable `Space · Tab · Pane` hierarchy while omitting unavailable or internal-id-only levels (ed11391)

### Changed

- Alert replies remove blank lines and place the Fleet link immediately on the final line for a more compact Discord layout (02b503f)
- Native Collie headers omit the redundant dog/home affordance only while framed, allowing the breadcrumb to shift left; direct and new-tab pages retain the existing logo and home action (152a3a0)

### Security

- History enrichment excludes user turns, reasoning, tools, summaries, notes, and all other entries; bounds response bytes and reply characters; never enters Fleet state, logs, or backoff; and cannot mark a Pane seen (2bac34c)

### Upgrading

- This patch remains wire-compatible with `2.1.x` node bridges. Older nodes keep link-only alerts when History is disabled and retain their prior embedded-header presentation until separately upgraded.

## [2.1.7] - 2026-08-15

### Changed

- Fleet now holds each new `Ready · unseen` or `Needs You` state for ten seconds and sends only after a later authoritative fetch confirms the same actionable group; handling, offline state, removal, or identity replacement cancels the candidate, and a continuous confirmed group never repeats (a8b86fe)
- Confirmation deadlines clamp the existing collector's one canonical next refresh while preserving its adaptive delay, single timer, in-flight coalescing, and five-second per-Host floor (a8b86fe)
- Confirmed Ready and Needs You alerts explicitly select the configured `success` and `needs-input` avatars; the default runtime header now uses generic `Fleet` instead of a concrete Tab, and the body remains only the canonical Pane link (a8b86fe)

### Upgrading

- This central notification patch remains wire-compatible with `2.1.x` node bridges, so remote nodes may defer updating and do not need a restart.

## [2.1.6] - 2026-08-15

### Changed

- Default-template Discord alerts now put the observed Agent's conventional harness name, workspace, and Tab in `pingme`'s compact runtime header instead of using static Fleet labels (d98f44f)
- The default message body is now only the clickable canonical Fleet Pane link, with no `Agent completed` / `Agent needs you` title or repeated context block; status and context remain available to custom templates as structured variables (d98f44f)

### Upgrading

- This central presentation patch remains wire-compatible with `2.1.x` node bridges, so remote nodes may defer updating and do not need a restart.

## [2.1.5] - 2026-08-15

### Added

- The central Fleet Gateway can send one local `pingme` Discord alert when a live Agent newly completes or enters `Needs You`, including Host/Pane context and a clickable canonical Fleet Pane link (6d91f08)
- Optional custom-template selectors receive stable Agent, state, Host, workspace, Tab, Pane, session, observation-time, and Pane-link variables while the default rollout continues to use `pingme`'s existing template (6d91f08)

### Changed

- Enabling Discord alerts advances the existing 2.1.4 Gateway collector in the background through its one shared five-second-to-one-hour backoff and per-Host floor, with a silent startup baseline and no duplicate schedule (6d91f08)

### Security

- Discord credentials remain exclusively in `pingme`'s private local configuration; Gateway invokes one configured absolute executable without a shell and never sends Pane contents, history, cookies, tokens, or SSH material (6d91f08)

### Upgrading

- This central-Gateway patch remains wire-compatible with `2.1.x` node bridges, so remote nodes may defer updating and do not need a restart.

## [2.1.4] - 2026-08-15

### Fixed

- Fleet now keeps one Gateway-owned 5-second-to-1-hour refresh backoff across every tab and enforces a non-bypassable five-second per-Host floor after successful or failed primary snapshot attempts (b5380f9)
- Offline Agent cards remain visibly stale but stay interleaved in `Needs you`, `Ready · unseen`, `Working`, or `Recent` according to their last confirmed state, including the header count's `Recent` exclusion (b5380f9)

### Upgrading

- This central-Gateway patch remains wire-compatible with `2.1.x` node bridges, so remote nodes may defer updating and do not need a restart.

## [2.1.3] - 2026-08-15

### Changed

- Fleet's Agent control now uses a recognizable Agent symbol with an inline count limited to `Needs you`, `Ready · unseen`, `Working`, and `Offline`, while the direct-open action uses the standard arrow-leaving-a-square symbol (4c5fd1d)

### Removed

- The Fleet header no longer exposes a logout button; the authenticated logout endpoint and cookie lifecycle remain unchanged (4c5fd1d)

### Upgrading

- This central-Gateway patch remains wire-compatible with `2.1.x` node bridges, so remote nodes may defer updating and do not need a restart.

## [2.1.2] - 2026-08-15

### Added

- Fleet's outer header now offers a Collie-aligned Agent menu that groups every Host and named session by attention state and opens the exact instance, session, and Pane when selected (9ba6109)

### Changed

- Fleet refreshes on page load and menu open, then doubles unchanged polling from five seconds up to one hour; failed Hosts or sessions retain explicitly offline last-known cards until an authoritative recovery (9ba6109)

### Security

- Cross-host aggregation strictly validates and allowlists Agent-card fields while excluding Pane output, histories, credentials, authorization state, update metadata, and unknown snapshot fields (9ba6109)

### Upgrading

- This central-Gateway patch remains wire-compatible with `2.1.x` node bridges, so remote nodes may defer updating and do not need a restart.

## [2.1.1] - 2026-08-14

### Added

- Remote SSH inventory entries may use an optional, fully pinned jump endpoint without inheriting ambient SSH configuration (a9d7cf4)

### Fixed

- SSH transports remain `starting` until the loopback forward accepts a connection, and failed attempts retain capped exponential backoff (a9d7cf4)

### Security

- Jump and target host keys are independently pinned, their private identities cannot overlap, and neither SSH layer permits agent forwarding or multiplexing (a9d7cf4)

### Upgrading

- This central-Gateway patch is wire-compatible with `2.1.0` node bridges, so remote nodes may defer updating and do not need a restart.

## [2.1.0] - 2026-08-08

### Added

- A Pane-context action and transient popup now copy the focused Pane's canonical Fleet deep link through Herdr's foreground-client OSC 52 clipboard path, including named sessions and remote attaches (3db28e4)
- Generic installs can enable the shortcut with public Fleet origin/instance metadata and a documented `prefix+ctrl+r` qualified plugin binding (3db28e4)

### Security

- The shortcut validates and encodes every route selector, reads no Pane contents or Gateway inventory, and copies no login cookie, password, token, SSH identity, or central credential (3db28e4)

### Upgrading

- This minor release adds node-side manifest entrypoints and configuration. Reinstall or update the plugin on each node where the shortcut should be available before adding the binding.

## [2.0.4] - 2026-08-08

### Added

- Fleet links now preserve the selected instance, named session, and Pane while Collie navigation updates the outer URL without reloading the iframe (d6e1447)
- Release validation now classifies exact SemVer transitions, permits compatible patch skew, and requires explicit exact-version approval for minor and major releases (73ccf1a)

### Security

- Fleet accepts route updates only from the selected iframe at its exact configured origin and only through a bounded, versioned home/Pane message schema (d6e1447)

## [2.0.3] - 2026-08-08

### Fixed

- Fleet embeds now expose only Collie's intended route-content scrollbar instead of adding a competing iframe document scrollbar on desktop and mobile viewports (33cdd79)

## [2.0.2] - 2026-08-08

### Security

- Remote nodes are zero-central-secret: enabled SSH instances require non-reused private identities, and dedicated tunnels ignore ambient SSH configuration, agents, multiplexing, shells, and unrelated forwards (6403d05)
- Gateway filters its authentication credential in both directions, including upstream attempts to replace the central session cookie, while preserving unrelated Collie cookies (6403d05)

## [2.0.1] - 2026-08-08

### Fixed

- Fleet logout keeps an exact same-origin CSRF signal while retaining no-referrer behavior for cross-origin requests and node documents (a9133bb)

## [2.0.0] - 2026-08-08

### Added

- Mobile-first Fleet shell with a compact instance switcher and one width-limited native Collie iframe; selection is URL-addressable and remembered locally (6158b2c)

### Changed

- Fleet now delegates session and pane navigation entirely to each node's Collie UI instead of maintaining a separate aggregate session dashboard (6158b2c)

### Security

- Fleet may frame only exact enabled node origins, node HTML may be framed only by the exact Fleet origin, and APIs/assets remain non-embeddable (6158b2c)

## [1.0.0] - 2026-08-04

### Added

- Single-account Fleet Gateway, multi-instance local/SSH inventory, transparent Collie routing, and a responsive health dashboard (c8f7a28)
- Herdr-coupled plugin supervisor with race-safe ensure, generation replacement, child backoff, and bounded ownership health (c8f7a28)

### Changed

- Supported deployment is loopback behind an operator reverse proxy; Tailscale and OS-service management were removed from the plugin workflow (c8f7a28)

### Fixed

- Public responses now carry HSTS, login-source state is bounded, `.env` permissions fail closed, and supervisor generations cover all production backend sources (d903aca)
- Proxy responses no longer retain stale gzip/length headers after Bun decodes Collie upstream bodies (279a67d)

## [0.23.1] - 2026-08-03

### Fixed

- `update` now works in a `herdr plugin install` checkout — it is detached and shallow, so `git pull --ff-only` could never run there (#63) (aeeddcd)
- `update` no longer re-links a Herdr-managed checkout, which would re-register it as local and block `herdr plugin install` (aeeddcd)

### Upgrading — `herdr plugin install` users must reinstall once

The fix ships *inside* the checkout it repairs, so `invoke update` still can't run on an install made
before 0.23.1. Take the fix with one reinstall (config and serve state live outside the checkout and
survive), after which `invoke update` works normally:

```bash
herdr plugin install AltanS/collie --yes
herdr plugin action invoke restart --plugin herdr.collie
```

Installs from a `git clone` + `herdr plugin link` were never affected — use `invoke update` as usual.

## [0.23.0] - 2026-08-03

### Added

- **Every key press and quick reply now answers you.** A nav-tray press was silent on success and deferred to a mirror that can be ~2s behind, so tapping Enter felt like nothing happened; the pressed button now fills on the tap (synchronous, no network wait) and shows a ✓ once the bridge accepts it. Quick replies echo on the tapped button and the dock outlives the send, closing after the ✓ instead of on the tap (3be4934)
- **Hold an arrow key to repeat it** — driving a long TUI menu no longer means tapping ↓ fifteen times. Repeats accumulate locally and flush as one batched `send_keys` array with exactly one call in flight, because ordering across two concurrent one-shot RPCs is unguaranteed. Arrows only, by whitelist; a hold while composing stages one chip, not fifteen (e7ada40)
- **Haptics** — a short buzz on press, toggleable in Settings, silently absent where the platform has no `vibrate` (e7ada40)
- **Quick replies follow the pane kind:** a shell gets `y`/`n` instead of "commit and push" and "skip", which mean nothing at a bash prompt (e7ada40)

### Changed

- **The pane's two control rows are now one.** Wrap, raw terminal and text size moved behind a ⚙ into a labelled panel — the raw-terminal escape hatch had been a bare `>_` glyph whose only explanation was a `title` attribute no phone ever shows, and it now says what it does. Find moved to the header, where its find bar already takes over the row. The mirror gets ~85px back (3be4934) — general direction from @simonallfrey in #49, whose "consolidate the terminal toolbar" proposal is what started this; thank you
- Closing the Keys dock on a composed key queue takes a second tap. The queue is still discarded rather than persisted — one surviving into a later open would let Send fire yesterday's chord into today's TUI state — and the guard sits on the drawer transition, since the Keys toggle and the Quick/Agent/Display buttons unmount the tray just as effectively as the ✕ (e7ada40)
- A single key press revalidates on the leading edge instead of sitting out the full 300ms burst window before its refetch even started; bursts still coalesce into one trailing refetch (3be4934)

## [0.22.0] - 2026-08-03

### Added

- **OpenCode panes get Conversation history.** OpenCode ≥1.x keeps every session in one SQLite database (no per-session log), so its journal adapter reads `opencode.db` readonly with bound parameters, touches only the three transcript tables (the same file holds auth tokens), and serves all sessions through a per-session cache key. Needs `herdr integration install opencode` once, then restart OpenCode in the pane (#61, 539cdf4) — reported by @xabilarra
- **A multiselect question inside a wizard is now a tappable dialog**, not raw terminal text. It was owned by no grammar — wizards refuse checkboxes (a wizard digit selects *and* advances; a checkbox digit only toggles) and multi-select only knew the single-question form. It now carries the wizard's step chips, navigates with the wizard's own Left/Right keys, and reads the advance row's label ("Next" / "Submit") from the pane by position, never by assumption (#51, bdf4c26) — thanks @konpyl

### Fixed

- **A preview dialog whose option label wraps no longer falls to the raw mirror.** The grammar required numbered rows on consecutive lines, but the ~30-column gutter wraps longer labels onto continuation rows; a contiguity walk anchored on the label column replaces adjacency (#51, bdf4c26) — thanks @konpyl
- `ReadSource`'s unwrapped variant matches the wire: `recent_unwrapped`, snake_case — the kebab spelling was rejected by Herdr and nothing had ever called it. HERDR_API.md records the probed contract, including that the source is a byte-identical no-op for Claude panes (alt screen + renderer-hard-wrapped prose), which is what closed #53 part 2 by measurement (bddded3)
- `multi-select-action.ts` no longer carries a literal NUL byte (git classified it binary and hid its diffs from review); `.gitattributes` keeps any future stray byte from costing reviewability (#51, bdf4c26)

## [0.21.0] - 2026-07-31

### Added

- **macOS supervises the bridge with launchd.** `start` installs a LaunchAgent (`~/Library/LaunchAgents/herdr.collie.plist`), so the bridge comes back at login and restarts on failure — the parity with the `systemd --user` unit that macOS never actually had (#55, #57, a0be73d) — thanks @darieldatoon
- **The statusline strip shows every row of the run, in the agent's own colour.** Model, cwd, git branch and permission mode live on rows 2+ and were surfaced nowhere; the strip renders them stacked, in the mirror's colour space (#60, 61db7a5, ac3c62d)

### Fixed

- **Sending no longer stalls under a tall statusline** (the run may be 8 rows, was 3). A taller run made `locateInputBox` miss the input box, so a send typed the text and then withheld Enter — with no stranded-draft preview and no pre-clear sweep, so retries stacked duplicates in the pane. Reproduced on a 3-row statusline sitting one wrapped line from the cliff (#54, #56, fe8e548) — thanks @stekman08
- `launchctl bootstrap` is retried across launchd's teardown window, so `restart` — and therefore `update` — can't end with the bridge down (b1ebb83)
- A Mac that can't bootstrap (no console login, so no `gui/<uid>`) keeps an unsupervised bridge instead of exiting with nothing running; `status` reports that degraded tier (5b5106c)
- The pi journal fixture is portable to macOS, where `containedRealpath` resolves `/var` → `/private/var` by design and the backend suite couldn't run at all (a7d8f9a)

### Changed

- **The mirror wraps by default.** Herdr spawns panes at the desktop terminal's width against a phone's ~45–50 columns, so panning was the common case, not the exception; column-faithful no-wrap stays one tap away in View. Display prefs reset to defaults on first load (storage key v4), so a pinned font size needs setting again (#53, 273d886, 73cc7da) — reported by @waynehoover
- ADR 0004 records that the statusline-run bound guards less than it looks: a dialog below the input box is refused by the border checks and by the blank line above its footer hint, never by the row count (36c78c7)

### Upgrading

- **macOS installs migrate on the next `update` or `start`**: the old unsupervised bridge is stopped and replaced by the LaunchAgent. It's a *LaunchAgent*, so it starts at **login**, not at boot — and a Mac administered purely over SSH has no `gui/<uid>` to bootstrap into, so it stays on the unsupervised bridge with a warning until someone logs in at the console once.

## [0.20.2] - 2026-07-30

### Fixed

- `herdr plugin action invoke update` no longer dies with `bun not found on PATH` — Herdr spawns actions with no login shell, so Bun is now found in its install locations too, not just on `PATH`. A failed run had already fast-forwarded the checkout, leaving the old `web/dist` being served (#52, 08f44f6) — thanks @konpyl
- Only an absolute Bun path is prepended to `PATH`, so a `bun` shell function in the plugin `.env` can't put the CWD in front of `git` / `systemctl` / `tailscale`; the control script's Bun resolution now has test coverage (4841e37)

## [0.20.1] - 2026-07-29

### Fixed

- Journal rotation-following re-checks containment, so a sibling symlinked out of the Claude projects root can no longer be served as a pane's history (e8b1357)

### Changed

- Dependency versions must be 7 days old before they install, via `bunfig.toml` (`.npmrc` for npm users) (bf38d45)

## [0.20.0] - 2026-07-29

Three contributions from @konpyl carry this release — light and system themes (#41), the triaged
dashboard (#42) and tappable URLs in the mirror (#45), landed via #46/#47/#48 with review fixes on
top. Thank you: measured rather than estimated, with the reasoning written down where it will be
argued about again.

### Added
- **Light and system themes.** Collie follows your phone's appearance by default; pin Light or Dark from **Settings → Appearance**. Per device, and documented under [Dark mode / light mode](./README.md#dark-mode--light-mode) (#41, 59bcfe1, df47112)
- ANSI slots 0–15 are now CSS variables (`--ansi-*`), so indexed terminal colour is defined in one place and reaches the mirror through both `31m` and `38;5;1` spellings (59bcfe1)
- **The dashboard is triaged, not listed.** Needs you → Ready · unseen → Working → Recent; the first three are pinned, Recent sorts by when you last used each pane (#42, da4f44c)
- **Ready · unseen** — agents that finished while you weren't looking. Opening one clears it, on every device (2f4d691)
- Recent and Spaces fold and remember it; fold both and the page is the triaged herd and nothing else (da4f44c)
- The swipe-up **Switch pane** sheet folds its long tails too — Recent, and the bare **Shells** group that buried the agents underneath it (4cca8db)
- Spaces are ordered by last used and filterable — 45 of them are now three keystrokes, not a scroll (da4f44c)
- The bridge keeps two timestamps per pane (`activeAt`, `seenAt`) in `activity.json`, because Herdr reports none (2f4d691)
- **Tab and space chips carry a status dot** — blocked / ready / working / idle, in the herd list's own palette. They only ever showed a dot for blocked before, so every other state read the same as every other (22d4a5f)
- **URLs in the pane mirror are tappable** — `http(s)://` text becomes a link that opens in a new tab, keeping the colour the agent printed and marked by an underline (#45, cc38351)
- Trailing prose punctuation is trimmed with paren balance respected, so `Fetch(https://x.dev/a)` links the URL and not the paren; a find hit inside a URL still highlights, and a URL that changes colour mid-way stays one link (cc38351)

### Changed
- The pane mirror renders in dark space under every theme and light mode inverts it, because agents emit truecolor almost exclusively and no palette can re-theme an absolute colour — [ADR 0002](.adr/0002-invert-the-light-terminal-mirror.md) (78425bd)
- In light, the page is a step off white with cards staying white, so the dashboard's hierarchy no longer rests on a single hairline — and the mirror's edge stops showing a seam (59bcfe1)
- **Agent rows are titled `project · tab`, not "claude".** The pane's own name moves to the second line; the agent stays in the avatar (da4f44c)
- Spaces moved BELOW every agent section — it's a navigator, not a work queue (da4f44c)
- Only Collie's own reads count as seeing a pane; a Herdr focus at the desk does not — [ADR 0003](.adr/0003-one-shared-seen.md) (6786ca1)
- MINOR, not MAJOR: pre-1.0, purely additive, no config or API break. Defaulting to your phone's appearance is the feature working as designed and Settings pins it either way; an older bridge reports no activity timestamps and simply renders the previous dashboard, minus the one section that would be empty

### Fixed
- **The space and tab chip rows overlapped each other on the space screen** — both strips were missing `shrink-0` inside the route's flex scroller, so they collapsed to 16px around 32px chips and the tab row painted over the space row. Pre-dates this release (636b7af)
- Three `role="alert"` warnings (incomplete multi-select, wizard, preview) used a hardcoded yellow that measured ~2:1 on white; they use the status palette now (59bcfe1)
- An off notification switch was unreadable in light — a white thumb on a 1.09:1 track, legible only by its shadow. It carries an outline now (59bcfe1)
- Focus rings were drawn at half strength, 1.77:1 in light and 1.87:1 in dark; both are full strength now (59bcfe1)
- Small muted text (section labels, the build stamp, the terminal status line, the `(n)` counts) fell under 3:1 in light — light `--muted-foreground` had no headroom left for the `/70` and `opacity-60` modifiers stacked on it, so it was darkened and the modifiers dropped (59bcfe1)
- Header controls had 20px touch targets; the Settings gear and the Settings back button are both 44px now, with no change to how they look (59bcfe1)
- The boot splash stepped from white to the page colour when React took over, and its caption measured 3.45:1 — it used `#ffffff`/`#8a8a8a` under a comment claiming they matched `--background`/`--muted-foreground`, which rasterize to `#f5f5f5`/`#5d5d5d`. Same fix for the light `theme-color` meta, so Android's URL bar matches the page (7f0189d)
- Inverse-video segments in the mirror emitted theme tokens while the muted glyphs beside them used literals; the mirror keeps one spelling now (identical pixels — the literals are those tokens' dark halves) (7f0189d)
- Marking a pane seen had made a read-level GET mutate state, so a cross-site `<img>` at a guessed pane id could silently clear your unseen agents. Only a request carrying the app's own header counts now — caught in this release's security review, never shipped (f9000cb)
- Only a request that will actually be served marks a pane seen — one falling through to 405 no longer clears an alert (f7e616b)
- **Light `--accent` was byte-identical to `--background`**, so "this is the current one" showed nothing in light mode — the open pane in the switcher, the current session, every `hover:bg-accent`. Predates this release; found by the UX sweep (dab7e05)
- Titles truncated away the tab — the only part that identifies a row — leaving several panes rendering the same `moonward_os · t…` (8a8a4c9)
- Section headings rendered at two different sizes and cases, because a `<button>` doesn't inherit `text-transform` from its `<h2>` (8a8a4c9)
- A hollow status ring on the avatar's corner read as a notch cut out of the logo (5c04453)
- A space row and its chip could disagree about what a colour meant — the row still ranked by `STATUS_RANK` while the chip used the triage classifier, so a space holding one working agent and one unseen-done agent showed "working" on the dashboard and "ready" in the strip. Both route through `bucketOf` now, in one pass rather than spaces x agents per render (e024f48)
- `aria-controls` on a collapsed section pointed at an element that isn't rendered — exactly when a screen-reader user is deciding whether to expand it (e024f48)
- A status dot passed a smaller size only resized its wrapper, so chip dots rendered at the wrong size (e024f48)
- The Settings page rearranged itself a frame after opening — Notify-when and Snooze mounted only once push state resolved, inserting ~400px into the middle of the page, and Notify-when then grew another ~180px waiting on its own prefs. Both render from the first frame now, switches disabled until their values land (3d5b191)
- The pane row ran straight into terminal output with no edge between them, so the chrome and the mirror read as one surface (e208408)
- Herd and space rows had a border radius with no border to own it, so a rounded hover fill sat under a straight `divide-y` hairline. Rows without a border are square; the ones with a real border keep their radius (3d5b191)

## [0.19.0] - 2026-07-29

### Added
- **Journal (pane history) is now per-harness, with Codex and pi support.** Reading an agent's own session log is an adapter keyed on the pane's agent (`bridge/journal/`), so a new harness is an adapter rather than a fork of the reader — Codex reads its date-partitioned `rollout-*.jsonl`, pi its per-cwd session log. Raised in #40 by @simonallfrey, who asked where to implement journaling for Codex (7e3b2bd)
- **`scripts/journal-probe.ts`** probes every adapter against the real logs on the host — the format-drift check unit tests can't make. It caught Codex 0.145 adding a `developer` message role the parser would have rendered as operator speech (7e3b2bd)

### Fixed
- **pi could never have had history.** pi reports its session as a kind-`path` ref (an absolute path) and the bridge kept only kind-`id` refs, so a pi pane arrived with no session at all. Both kinds are kept now; a path ref is confined to that harness's root after symlink resolution (7e3b2bd)
- **A pane relaunched as a different agent served the previous agent's session ref.** Herdr keeps reporting the last session announced for a pane — a pane running pi still advertised a `herdr:claude` id. The ref is dropped unless its own `agent` matches the pane's (7e3b2bd)

### Changed
- **A pane's session reference no longer goes to the browser.** `/api/snapshot` sends `hasSession` instead — for pi the reference is a filesystem path, and the History affordance only ever needed "may this pane have history?". It is now also gated on the harness actually having an adapter (7e3b2bd)

## [0.18.0] - 2026-07-28

### Added
- **Approvals are bound server-side to the prompt they were decided against.** `/keys` and `/reply` accept an optional `expected_prompt`; the bridge re-reads the pane immediately before writing and refuses with `409 prompt_changed` if the dialog moved. Shrinks the guard window from human latency to two local RPCs — a mitigation, not a guarantee, until herdr gains a conditional-input primitive (#29) — thanks @Optic00 (6afaf5b)
- **`/auth/` is reserved for a fronting proxy's sign-in page**, and the service worker always passes it to the network. An installed PWA could not reach a proxy page at all before — the precache answered every navigation, reload included — so operators had to squat a page inside `/api/`. The refusal banner now links there (#31) — thanks @Optic00 (1a5972b)

## [0.17.0] - 2026-07-27

### Fixed
- **A reply sent while an agent dialog was focused answered the dialog instead.** The submit key approved whatever option was highlighted (Claude defaults to "Yes") and the message was destroyed, while the bridge reported success. Sending now refuses outright while a dialog is up, and otherwise types first and only submits once the text is verified in the input box (#34) — thanks @maikschuheida-spec

### Changed
- Free-text replies on harnesses with a block grammar (Claude) are two steps — type, verify, submit — so "Sent ✓" now means the text was seen in the input box. Harnesses without an adapter keep the previous one-shot send

## [0.16.1] - 2026-07-27

### Fixed
- `/api/config` is now gated like every other endpoint — it was the one route that skipped the same-origin check and `COLLIE_PUBLIC_HOSTS`, noted by @Optic00 in #32 (a54afd9)

## [0.16.0] - 2026-07-27

### Added
- Bring-your-own-tunnel deployment path documented as **Variant E** — NetBird, ZeroTier, Cloudflare Tunnel (6550041)
- `scripts/collie-ctl.test.sh` — first lifecycle coverage for the control script, wired into the pre-push hook (a004449, 65889da)

### Fixed
- `unserve`/`uninstall` no longer remove a `tailscale serve` mapping Collie didn't create, and `start` no longer replaces one (a004449, thanks @iamtimmy)
- A front door that fails to publish no longer aborts `start` before the status banner (65889da)

## [0.15.0] - 2026-07-26

### Added
- Pane conversation history read from the agent's own transcript — scroll back past the live mirror (77dff7c)
- Windows support for the bridge: dials herdr's named pipe through `node:net`, one code path for both platforms (#25, #27) — thanks @mikebenner and @bwright2810 (dd6610d)
- `COLLIE_HERDR_DIAL=auto|net|bun` forces the dialer; `net` exercises the Windows path on Linux/macOS (f662834)

### Changed
- **Breaking, only if `COLLIE_DEVICE_HEADER` is set:** a request arriving *without* the device header is now read-only. It previously got full write access, which let any tailnet client reach the bridge's own URL and skip the proxy that injects the header. Front doors that inject it on every request are unaffected; direct loopback/MagicDNS access now needs the header sent by hand (#28) — thanks @Optic00 (8ed715d)

### Fixed
- A 401/403 no longer renders as an endless "reconnecting" banner — an access refusal now says so and offers Reload (#30) — thanks @Optic00 (7bdcbfb)

## [0.14.2] - 2026-07-23

### Added
- Paste an image straight from the clipboard into the composer, same upload path as the picker (#24) (ad6957b)

## [0.14.1] - 2026-07-22

### Fixed
- `collie-ctl.sh self_dnsname` shelled out to `node`, which Collie never requires — now uses `bun` (#22) — thanks @jz-wilson (a61f3d1)

## [0.14.0] - 2026-07-21

### Added
- Alt modifier in the nav tray — `alt+<key>` chords now reachable from the phone (#19) — thanks @bnivanov (d1dc947)
- Modifiers combine (checkbox, not radio): `ctrl+shift+p`, `alt+shift+p`, even triple chords (#20) (d1dc947)
- Modifier lock — tap an armed modifier again to keep it armed across presses and Sends; Clear or a third tap releases (#20) (d1dc947)

### Changed
- HERDR_API.md: multi-modifier chords live-verified in any order against Herdr 0.7.3, cross-confirmed on 0.7.4 by @bnivanov (b505c4e)

## [0.13.2] - 2026-07-20

### Fixed
- Tabs render in Herdr's reported order instead of stable-number order, so a reorder in Herdr survives to the screen — thanks @iFwu (a16478f)
- Tapping raw terminal output focuses the composer synchronously, keeping iOS's user-activation window so the software keyboard opens — thanks @iFwu (a78ccfd)

## [0.13.1] - 2026-07-20

### Fixed
- Taking over or sending a draft no longer permanently mutes the preview for that same text — the handled key resets once the host line clears (7153639)
- Send's pre-clear sweep overshoot widened 8 → 32 so host typing inside the poll gap can't leave a remnant (7153639)
- A scrollback line starting with `❯` can no longer pin a bogus session name — only the live (bottommost) prompt decides (808cce7)

## [0.13.0] - 2026-07-19

### Added
- Long-press a pane pill for a pane actions sheet — rename + two-tap close (5b50941, c713551, 90210ce, ea20df0)
- Pane rename end-to-end: `pane.rename` RPC, bridge route, label threading (99c8808)
- Tab rename + tab close (blast-radius confirm) via the same long-press sheet on tab chips (a9664b5, 37a470e)
- Claude's own `/rename` session name surfaced on cards, headers, and the switcher (d22fdd7)
- Read-only "Draft in terminal" preview with explicit Take over — the composer input is exclusively phone-owned (4b6f0ac, 10fa28d)
- Self-update without the service worker: `X-Collie-Build` on polled responses, auto-reload or tap-to-update banner (8d13622)
- Instant offline navigation — during a known outage, routes serve the last good snapshot instead of hanging on a dead fetch (b756edd)
- Busy strip on genuinely hung loads: navigations >500ms, background polls >6s (e886541, 3bfaa1c, 06516c4)
- `-dev` marker in the build stamp for non-release builds (3e785f4)

### Changed
- One shared `AppHeader` for dashboard, space, and pane — same components underneath, stale status badges dim during outages (29432c2)
- Connection status is a single animated top bar — amber "reconnecting…" after 4s of trouble, red with Retry at 15s, green flash on recovery; no header pill (394e6fe, b2dd50e)
- Switcher sections carry status-colored bullets; per-row close removed (switching is the only action there) (3918c69)
- `assets/*` served immutable, everything else `no-cache` — proxy caches can no longer starve `/sw.js` updates (8d13622)

### Fixed
- Own in-flight reply no longer flagged as a stranded terminal draft (e8462f9)
- Wrapped multi-line drafts and the new background-agents footer no longer break input-box detection (829fc7e, d9521e3)
- `navigator.onLine` never gates polling or liveness — lying flags can't wedge the app or fake outages (d31ffb8, 394e6fe)
- One shared connection-lost clock; escalation survives route changes and app switches until a poll succeeds (1486e07, 5949885)
- Sustained outages escalate everywhere — boot splash, header, banner — with Retry/Reload (0cbbac1, 4d89588, 4494cf5)
- Gallop sprite re-centered; the dog never freezes mid-stride (rest state is the static icon) (3c7174a, 394e6fe)
- Offline banner no longer overlaps the sticky header (bf98a88)

## [0.12.0] - 2026-07-17

### Added
- `COLLIE_SKIP_SERVE=1` env var to disable tailscale serve entirely — bridge stays on loopback only, ideal for deployments behind a reverse proxy (Caddy, Nginx, etc.) — thanks @diogenesc (ad5833a)
- `COLLIE_PUBLIC_URL` — `collie-ctl.sh status` banner shows your real reverse-proxy URL instead of a placeholder (4b043be)
- Bridge startup warning when `COLLIE_TRUSTED_USER` is set under `COLLIE_SKIP_SERVE=1` — the identity gate is inert without tailscale serve injecting `Tailscale-User-Login`; use `COLLIE_DEVICE_HEADER` (4b043be)
- README Variant C — reverse proxy as the only front door (no Tailscale), with Caddy example and required env (76019f7)

### Changed
- `collie-ctl.sh unserve`/`uninstall` always attempt serve teardown, even under `COLLIE_SKIP_SERVE=1` — a stale mapping from before the flag flip would keep publishing the app (4b043be)
- Security posture docs: "tailscale serve is the sole ingress" → "exactly one hardened front door" (tailscale serve or a conforming reverse proxy) across README, ARCHITECTURE, CLAUDE.md (76019f7)

## [0.11.1] - 2026-07-16

### Fixed
- Opening a tab/pane lands on the live tail — terminal `<pre>` no longer steals vertical scroll from the message list; stickiness also re-pins when content grows (04bf6fc)

## [0.11.0] - 2026-07-15

### Added
- Pluggable harness-adapter architecture: a `HarnessAdapter` registry replaces the single Claude-only gate, Claude's detectors move to `lib/harness/claude/`, and a core race-guard engine (`lib/harness/guard.ts`) is the only module that may touch the network — an import fence (enforced by `fence.test.ts` under `bun run test`) + a conformance suite let contributors add codex/pi/opencode (see `HARNESS_CONTRIBUTING.md`)
- multiSelect AskUserQuestion support: checkbox options up-level to tappable checkbox rows (terminal is source of truth), with a closed-loop Submit that navigates the pointer to Submit and verifies before Enter (never blind-sends), plus the review/confirm screen
- Prompt overlay: interactive prompts render in a bordered `bg-card` panel that lifts the whole dialog off the terminal mirror, with elevated option rows, leading key-digit badges, and a family-aware caption
- Update notifications: a footer banner (linking to the GitHub release) and an opt-out web-push when a newer release is published upstream or the running bridge is behind the on-disk code — checks the repo's tags over anonymous HTTPS, stamps its own sources for the restart signal, a Settings "check for updates" button forces an immediate check, an `updates` notify pref is the off-switch, and update/restart are surfaced as location-independent Herdr plugin actions

### Changed
- Keys and Quick menus dock in-flow above the controls row instead of a fixed overlay, so the terminal mirror shrinks and re-pins to the bottom (ResizeObserver) — the prompt/cursor stays visible; both buttons are toggles
- Prompt option rows compacted (tighter padding, snug line-height) so a multi-option dialog fits the phone viewport
- "Sent" status toast moved from a bottom overlay (which covered the terminal tail) to a slim in-flow row below the header
- Build stamp marks a dirty working tree (`<sha>-dirty`), so the footer no longer claims HEAD when the build carries uncommitted work
- multiSelect Submit is ~2s instead of ~15s: the pointer walk re-reads the actual position each step and stops on "Submit", instead of polling for the bottom row after every key (which timed out ~2.8s per step)

### Fixed
- Prompt-select + wizard grammars: a numbered list in a dialog body (e.g. a plan's steps) no longer breaks menu detection — the menu is taken as the trailing `1..m` run, so plan-approval prompts up-level correctly

## [0.10.3] - 2026-07-12

### Fixed
- `collie-ctl.sh build` installs the root dependency tree (not just `web/`) before typechecking, so a fresh Herdr install no longer fails with TS2688 "Cannot find type definition file for 'bun'" (03f409f, #9)

## [0.10.2] - 2026-07-12

### Fixed
- Composer Send clears a stranded draft off the terminal `❯` line (ctrl+k + Backspace) before typing so replies no longer accumulate on the prompt; a clean prompt skips the clear (cd1cc25)
- Bridge settles ~350ms between typing and Enter so the TUI reliably accepts the submit key (cd1cc25)

## [0.10.1] - 2026-07-11

### Fixed
- Terminal mirror defaults to no-wrap for table alignment like desktop Herdr; clearer borders/typography (font 12, muted-foreground box-drawing); pane stays viewport-width — toggle Wrap on in View for prose (85f777b)

## [0.10.0] - 2026-07-10

### Added
- Herdr session switcher: one bridge fronts every named herdr session — `?session=` on the API, `?s=` in the app, a sessions summary in the snapshot, per-session notification slots, and a `COLLIE_MULTI_SESSION` kill-switch (8fa1f20)
- Space detail is a deep-linkable route (`/space/:spaceId`) with a working browser Back button, replacing the in-home drill-in state (0e5f9c8)
- Terminal-draft recovery: a queued-then-recalled message stranded on the "❯" input line surfaces as a composer chip, with "Edit here" to clear the line and adopt the text cleanly (46dcf35)

### Changed
- Dashboard leads with "Needs you" — agents awaiting your input sit at the top, above the spaces overview (1d92592)
- Dashboard, space, and settings scroll inside a viewport-clipped region instead of the whole document (2aa9272)
- Session switcher and the session chip are dashboard-only, keeping the in-space and pane headers clean (bb0048d, ba56ba9)
- Header polish: consistent compact height across the dashboard and inside a space, zinc-800 nav chrome, a ringed Collie mark, a smaller pane-header agent logo, and the keyboard-only quick-keys strip removed (6250e0c, 9da7195, 35db0e5, ba56ba9)
- Security posture documents that `COLLIE_MULTI_SESSION` (default on) fronts every named session under the config root (fcb0b7d)

### Fixed
- Deep-linking a space that never existed shows "Space not found" rather than "Space closed" (fcb0b7d)

## [0.9.1] - 2026-07-09

### Security
- Removed one-tap yes/no reply buttons from push notifications — they POSTed to the terminal without opening the app, i.e. approving blind. Notifications now only deep-link to the pane (cb26ee0)

## [0.9.0] - 2026-07-07

### Changed
- Quick keys mimic a physical keyboard on both surfaces: Esc top-left, Tab below it, inverted-T arrows, Enter top-right; Keys sheet gains a full-width spacebar (2f70662)
- Attach image lives in the reply row (usable without the phone keyboard open); digits leave the inline strip — the 123 tab remains (2f70662)
- Header collie logo is transparent like the gallop sprite — removed favicon.svg's baked-in gray backing rect (3f05da8)

## [0.8.0] - 2026-07-07

### Added
- Poll herdr 0.7.2's `session.snapshot` — one RPC per tick instead of three list calls; permanent fallback to the list trio on older servers (5687bbf)
- Event-poked polling: `events.subscribe` stream triggers immediate debounced re-polls; interval relaxes to `COLLIE_POLL_IDLE_MS` (default 12s) while the stream is healthy (5687bbf)

### Changed
- HERDR_API.md re-verified against herdr 0.7.2 / protocol 16; terminal observe/control filed under ARCHITECTURE.md Future ideas (aad94b3)

## [0.7.0] - 2026-07-06

### Added
- Notification type prefs: Settings "Notify when" toggles per agent status, bridge-wide; default pushes only "Needs input" (blocked) — "Finished" (done) is off (98cf5d2)

### Changed
- Push sends carry a `collie-herd` topic + 6h TTL: an offline device now gets one current summary on reconnect instead of replaying every queued update (98cf5d2)
- Disabling a notification kind retracts its pending/outstanding alerts immediately (98cf5d2)

## [0.6.0] - 2026-07-06

### Added
- First-paint PWA splash: the galloping collie shows before React mounts (299f632)
- Keys sheet: `Ctrl` modifier + visible key queue — compose chords/sequences, review, Send as one call; dialer-size digits on a `123` tab (515f795)

### Changed
- Header Collie mark matches the agent logo (2rem, aligned across screens); Find lives in the composer View row; placeholder is just "Type a reply…" (11385ee)

### Fixed
- Option taps no longer pop the phone keyboard or steal the note editor's focus (11385ee)
- Stalled connections no longer zombify the app: fetch timeouts (10s/20s/60s), polls supersede a wedged revalidation at 12s, and the collie gallops within 2.5s of a stalled load or pane-tap navigation (e6ad939)

## [0.5.0] - 2026-07-05

### Added
- **Preview-variant question notes.** Claude Code's *preview* AskUserQuestion — a single-select
  question whose options carry a `preview` field (the mockup/snippet pane, footer hint
  `n to add notes`) — is lifted into a native block that surfaces the per-question note affordance.
  A note (attach / edit / remove) is driven from the native option UI and applies **per question**,
  not per option row. Delivery uses the verified staged keystroke choreography
  (`n` → confirm the input focused → clear → paste the text via the reply path → `Escape` to blur,
  each stage verified rendered before the next fires; `Enter` is never sent, since it would submit
  the dialog — see `web/src/lib/grammar/NOTES_NOTES.md`), and option selection is the two-step
  digit → verify-pointer → `Enter` recipe. Race-guarded like the other dialog blocks (a stale tap on
  a drifted dialog aborts before anything irreversible is sent). Claude-scoped (`hasBlockGrammar`)
  and web-only; the standard non-preview select and wizard steps are unaffected (pressing `n` there
  is a no-op, so no notes UI is shown).

### Security
- **Preview-note tap guard hardened to region-signature parity.** The preview dialog's race guard now
  carries a pointer- and note-independent **core signature** (the subject/question/stepper above the
  options joined with the option rows' left column, `❯` normalised) — matching the 0.4.0 `signature`
  parity the prompt/wizard guards already had. It is enforced at entry AND on **every** mid-flight
  acceptance/drift check, so a same-shaped successor dialog (identical question + labels, different
  subject) can no longer be answered by a stale tap: no digit-then-`Enter` or `Enter` is sent unless
  the fresh read's core signature byte-matches what the user saw. The blur poll is now three-valued
  (ok / drifted / timeout) so the Escape-retry fires only on a genuine swallowed key — never after the
  dialog drifted or vanished (which a blind second Escape could cancel / interrupt). Pasted note text
  is stripped of C0/C1 control bytes (ESC, BEL, …) before it can reach the focused input.

## [0.4.0] - 2026-07-05

### Added
- **Block-based terminal renderer.** Pane rendering now flows through a semantic Block AST (styled
  lines → typed blocks → React components) instead of a flat span mirror. The raw-block foundation is
  byte-for-byte identical to the old mirror, but it's the seam every feature below builds on —
  detected regions are lifted into native blocks in place, and anything unrecognized falls back to
  the raw mirror. Scoped to Claude Code (`hasBlockGrammar`); every other agent renders the plain
  mirror, since their TUIs are unverified.
- **Native prompt buttons.** A Claude single-choice dialog at the buffer tail (select, permission,
  trust, plan approval) is lifted out of the mirror and rendered as tappable buttons; a tap sends the
  per-family keystrokes (digit, or digit+Enter for AskUserQuestion), guarded so a stale tap on a
  scrolled-up menu can't fire. The agent's own input box/statusline are stripped so they don't
  duplicate the composer.
- **Status strip.** The stripped statusline (model · ctx% · cwd · branch · tokens) is re-surfaced as
  a slim line above the composer, so the branch/context stays visible instead of vanishing with the
  input-box chrome.
- **Submission progress bar.** A slim indeterminate bar across the top of the app while any mutation
  (reply, keys, prompt tap, upload, tab/space create, close, snooze) is in flight; background polling
  never triggers it, and a 120ms delay means a fast action never flashes it.
- **Raw-terminal escape hatch.** A View toggle (terminal icon) that turns off the block renderer —
  native prompt buttons, chrome stripping, status strip — and shows the plain mirror, so a
  mis-detected/mis-rendered dialog can always be driven by hand with the keys pad. Persisted.
- **Multi-question wizard.** A multi-question AskUserQuestion (the `☒ Focus area ☐ Scope ✔ Submit`
  stepper) now renders as a native step-by-step wizard instead of bailing to the raw mirror: the
  stepper chips (answered/current per question), the current question's options as tappable buttons
  (one digit each — verified: a wizard digit instant-selects and advances), back/next step
  navigation, and the final Submit review step (answers echoed, submit/cancel). Incremental
  round-trip: every tap is a single race-guarded keystroke re-derived against a fresh read; the TUI
  stays the source of truth. Choreography + fixtures documented in
  `web/src/lib/grammar/WIZARD_NOTES.md`.
- **Galloping Collie loader.** The mascot now doubles as the app's activity indicator: a 6-frame
  gallop sprite (`web/public/dog-gallop.png`, a 768×128 transparent strip) stepped through with a
  pure-CSS `steps(6)` animation (no JS timers). At rest it's the familiar static app icon
  (`favicon.svg`); it springs into the gallop on the boot splash while the first snapshot loads and
  whenever the connection isn't live (connecting / reconnecting / offline), settling back to the
  static icon once live. Honours `prefers-reduced-motion`. New `DogGallop` component; rough
  first-pass art to be replaced with higher-quality frames.

### Changed
- **One consistent top-left mark on every screen.** The Collie is now the brand + home button +
  connection loader in a single shared `CollieHome` component, rendered identically on the dashboard
  and inside a pane — so the header's top-left always means the same thing (previously a "stacks"
  icon inside a pane vs. the Collie logo on the dashboard). Inside a pane the Collie gallops on
  reconnect from the same global connection state as the dashboard (shared `isConnecting` predicate).

### Removed
- **The pane's Nav-hub drawer** (the left "stacks" drawer). It was redundant now that the Collie
  handles Home, the swipe-up switcher already covers pane switching/closing, and the breadcrumb
  covers cross-space jumps — removed along with its `SpaceList` component. The swipe-up switcher now
  appears whenever a pane is open, so even the last pane stays closable.

### Fixed
- **Multi-question AskUserQuestion no longer mis-parsed.** A multi-step AskUserQuestion (the
  `☒ Focus area  ☐ Scope  ✔ Submit` stepper) was detected as a single-question select and answered
  with one digit+Enter — submitting a half-filled form. It's now recognized as a wizard and left as
  the raw mirror (drive it with the keys pad, or via the new escape hatch) rather than mis-sending.

### Security
- **Prompt/wizard taps are guarded against same-shaped successor dialogs.** The tap race guard now
  compares a byte-signature of the whole dialog region — including the subject above the options (the
  diff/command being approved), not just the question and option labels. So a tap on a frozen mirror
  can no longer approve a *different* action that happens to render an identical-looking prompt (e.g.
  a second edit to the same file after the first was answered elsewhere). Herdr's `revision` is a
  stub, so this content signature is the load-bearing freshness check.

## [0.3.0] - 2026-07-03

A full-codebase review pass: four audit agents (backend, frontend, security, ops/product) swept the
tree; everything they found was verified, fixed, and the top feature gaps were built.

### Added
- **Reply from the notification.** Needs-you pushes now carry up to two quick-reply action buttons
  (agent-aware: codex gets `yes`/`no`, others `yes`/`continue`; bridge sends `quickReplies` in the
  payload). Tapping one POSTs the reply straight from the service worker and confirms with a silent
  "Sent ✓" — no app open needed. Body tap still deep-links as before.
- **Find in output.** A magnifier in the pane header opens a find bar: case-insensitive match over
  the visible buffer, match count, prev/next that cooperates with the scroll-freeze, highlights
  rendered through the same React-text-node path (XSS boundary untouched).
- **Load older scrollback.** A "load older" row at the top of the mirror grows the fetched window
  600 lines at a time (up to 5000; the bridge clamps reads at 10000), preserving your scroll
  position across the refetch.
- **Destructive-input confirm.** Replies matching a reviewed pattern list (`rm -rf`, `sudo`,
  `git push --force`, `dd if=`, `mkfs`, redirects to system paths, …) flip Send into a two-tap
  "Really send?" state for ~3s — same pattern the `/clear` palette action already used.
- **Audit log.** Every write action (reply, keys, upload, tab/workspace create, pane close) appends
  a single JSONL line — timestamp, action, pane, device, truncated params — to
  `<state-dir>/audit.log` (mode 0600). Audit failures never block the action itself.
- `COLLIE_PUBLIC_HOSTS` env var — an explicit Host-header allowlist. When set, requests addressed
  to any other Host are rejected before origin logic, defeating DNS rebinding. Strongly
  recommended (set it to your MagicDNS name); effectively mandatory with `COLLIE_SERVE_MODE=http`.
- Startup warnings when `COLLIE_TRUSTED_USER` or `COLLIE_PUBLIC_HOSTS` is unset — parity with the
  existing bind/allowlist warnings, since an empty trusted-user means any tailnet device has write
  access.
- Uploaded images are now swept after 48h (was: kept forever).

### Changed
- **Builds are gated.** `bun run build` (root) and `collie-ctl.sh build` now typecheck bridge and
  web before building, and build into `dist-staging` with an atomic swap — a failed build can no
  longer leave an empty `web/dist` serving 503s. The pre-push hook typechecks both sides too
  (`SKIP_TYPECHECK=1` to bypass once). Root tsconfig now enforces `noUnusedLocals/Parameters`.
- **Write requests without an `Origin` header are rejected** unless they arrive on loopback
  (browsers always send Origin on POST; curl-on-host keeps working).
- Idle lock is now timestamp-based: backgrounding/foregrounding the app no longer resets the
  countdown, and returning past the deadline locks immediately.
- The composer moved into its own `<Composer>` component; `agent-chat.tsx` slimmed by ~230 lines.
- A reply whose text lands but whose submit keystroke fails now reports "typed into the pane but
  not submitted — check the pane before resending" (and `textDelivered: true`) instead of a generic
  error that invited double-sends.
- systemd unit hardened (`NoNewPrivileges`, `PrivateTmp`) and made persistent
  (`StartLimitIntervalSec=0`, `RestartSec=5`) so a crash-loop can't leave the service permanently
  down while you're phone-only.
- Notification deep links URL-encode the pane id; sheets manage focus (focus in on open, restore on
  close, `aria-labelledby`); space status dots gained screen-reader text; pinch-zoom re-enabled
  (removed `maximum-scale=1`).

### Fixed
- **Socket leak on RPC timeout** — a stalled Herdr left the Unix-socket FD open on every timed-out
  request; under the 1.5s poll cadence this exhausted file descriptors and wedged the bridge. Every
  terminal path now closes the socket.
- **UTF-8 corruption across socket chunks** — multi-byte characters (box drawing, emoji) straddling
  a socket-read boundary rendered as `�`; replies are now stream-decoded.
- **Overlapping polls** — a slow Herdr let 1.5s ticks pile up 3-4 concurrent polls; a tick is now
  skipped while the previous poll is in flight.
- **Upload buffering** — a too-large upload was buffered fully into RAM before the 10MB check;
  oversized `Content-Length` is now rejected up front and `Bun.serve` caps request bodies at 12MB.
- Push subscription saves are serialized and written atomically (temp+rename); concurrent
  add/prune can no longer drop a subscription. State files are written 0600 in 0700 dirs.
- First PWA load no longer flashes an immediate reload (service-worker `controllerchange` on
  initial claim was treated as an update).
- A rotated VAPID key now unsubscribes the stale push subscription and re-subscribes fresh instead
  of silently dead-ending pushes.
- Superseded loader revalidations are aborted (`request.signal` threaded through); raw key presses
  debounce their revalidate (one refetch per burst instead of one per keystroke).
- Slash-command insert appends to the draft instead of overwriting it; tap-to-focus no longer
  collapses an active text selection (copying pane output works now).
- `envInt` config parsing rejects garbage and out-of-range values (negative poll/debounce
  intervals, invalid ports) with a warning instead of silently accepting them.
- Static-file path guard now checks the directory boundary (`dist` vs `dist-*`); `?lines=` is
  clamped; API/static responses carry `X-Content-Type-Options: nosniff` and
  `Referrer-Policy: no-referrer`; graceful shutdown drains in-flight requests.
- Pre-commit version guard now also covers `web/vite.config.ts`, `web/index.html`,
  `web/package.json`, `web/public/`, `systemd/`, and root `package.json`, and requires the new
  version to sort strictly above the old one.

## [0.2.0] - 2026-06-30

### Changed
- **Smarter push notifications.** A blocked/done alert is no longer fire-and-forget. Each one now
  waits a short **debounce window** (`COLLIE_NOTIFY_DELAY_MS`, default 30s) before it sends; an agent
  you clear at your desk within that window never reaches your phone. Alerts that *do* fire are
  **retracted** automatically once the agent resolves (or its pane closes), so handled work stops
  piling up on your lock screen. The service worker also **suppresses** the system notification when a
  Collie tab is already open and visible (the in-app status surfaces it instead).
- **Coalesced into one notification.** The whole herd shares a single notification slot: one agent
  shows the named, deep-linked alert; several collapse into a *"N agents need you"* digest (tap → the
  triage home) that updates in place as agents come and go, instead of stacking N separate alerts.

### Added
- **Do Not Disturb / snooze** (Settings → *Do not disturb*): pause all push for 30m / 1h / 4h, or
  resume early. Server-enforced and self-expiring, so it quiets every device — and it clears whatever
  is already on the lock screen the moment you snooze. The current deadline rides the snapshot, so it
  stays in sync across devices.
- `COLLIE_NOTIFY_DELAY_MS` env var — the push debounce window in ms (default `30000`; `0` notifies on
  the next tick with no debounce).
- `POST /api/notifications/snooze` — set/clear the global snooze (`{ snoozedUntil: number | null }`);
  the active deadline is reported on the snapshot as `notifications.snoozedUntil`.

## [0.1.0] - 2026-06-30

Initial public release of **Collie** — a phone web UI to monitor and reply to your Herdr agent
herd over Tailscale.

### Added
- **Mobile-first PWA** (Vite + React + TypeScript + Tailwind v4 + shadcn): a triage dashboard
  (Spaces overview + Needs-you / Working / Idle agent groups), a per-agent colored terminal mirror,
  an agent-aware slash-command palette (Claude Code, Codex, pi, opencode), a special-keys pad with
  inline arrows/Tab, per-agent brand icons, image upload, and animated view transitions. Installable,
  with an auto-updating service worker and a build-stamp footer.
- **Bun/TypeScript bridge** over Herdr's Unix socket: a polled live snapshot (adaptive cadence,
  gzip + `ETag`/`304`) plus reply / keys / upload endpoints, and space/tab/pane management (create
  shell panes, switch, kill) through a unified nav hub.
- **Runs as a `systemd --user` service** supervised independently of Herdr, with a `tailscale serve`
  launcher (`scripts/collie-ctl.sh`) and a thin Herdr plugin (`herdr.collie`) exposing
  start / stop / restart / status / url / version / update / uninstall actions. One-command update
  (pull → rebuild → restart → re-link) for the linked checkout.
- **Optional Web Push (VAPID) notifications** when an agent needs you, with a custom service-worker
  push handler that renders the real message and deep-links the tap to the agent's pane.
- **Security posture:** loopback-only bind, `tailscale serve` as the sole ingress (never `funnel`),
  a same-origin gate, an optional `COLLIE_TRUSTED_USER` identity check, optional per-device
  authorisation via a trusted upstream header, a strict CSP, and terminal output rendered as React
  text nodes (the XSS boundary).
