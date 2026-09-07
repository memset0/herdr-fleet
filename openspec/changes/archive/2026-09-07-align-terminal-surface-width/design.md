## Context

See proposal.md — Why. There is already only one physical `AppHeaderHost` above the outlet. The defect is the route's contribution: `FleetPaneRoute` switches between `DetailRoute`/`AgentChat` and `FleetTerminalRoute`, and `FleetTerminal` contributes only a monospace label through `RouteHeader`. It is not a second HTML header, but it is a second Pane AppBar implementation. The native contribution in `AgentChat` supplies the identity button, agent/state mark, disambiguator, cwd, `HeaderStatus`, `HostChip`, Pane actions and Find override. Sharing only the shell does not share those controls.

The mirror uses `ChatMessageList` with `px-2 pt-0 pb-3`. Its manual-fit helper measures `clientWidth`, subtracts both horizontal paddings, and measures 100 real monospace cells. `FleetTerminal` instead has an unpadded host and a retained `h-full w-full` child containing xterm. FitAddon 0.11.0 measures that child's computed width and xterm's real cell dimensions. With `scrollback: 0` it reserves no scrollbar width. The existing ResizeObserver observes the host; font readiness and loading events reopen/re-measure the existing terminal. Those mechanisms remain intact.

### Actual browser baseline and reversible experiment

Measured the deployed application bundle in a fresh headless browser context against an explicitly created, unfocused, disposable shell Pane. No user Pane was selected, focused, typed into, or attached. Fonts and display preferences were not changed. The current browser defaults resolved to a 10px terminal font, a 6px DOM monospace advance and a 6px xterm cell, at device-pixel ratio 1 after `document.fonts.ready`.

| Viewport | Route width | Mirror usable width / columns | Unpadded terminal columns | With 8px each side | Terminal rows before / after |
| --- | ---: | --- | ---: | ---: | --- |
| 320 × 740 | 320px | 304px / 50 | 53 | 50 | 50 / 50 |
| 390 × 844 | 390px | 374px / 62 | 65 | 62 | 58 / 58 |
| 1024 × 768 | 1024px | 1008px / 168 | 170 | 168 | 52 / 52 |
| 1440 × 900 | 832px | 816px / 136 | 138 | 136 | 62 / 62 |

The candidate was a temporary DOM style on the real host, not a repository edit. Its existing ResizeObserver/FitAddon path changed the actual rendered grid: at 1440px, 828px became 816px; at 390px, 390px became 372px inside 374px of usable width. None of these cases produced horizontal page overflow. Both baseline AppBars measured 61px including the rule at all four viewports, but only the mirror contained `pane-identity`, cwd, host context, and Pane actions. At 390px the native leading trigger and actions were each 44px, at x=8 and x=338 respectively; terminal mode retained only the leading trigger and label. Screenshots confirmed the information/control difference on phone and desktop.

**Evidence boundary:** this run used the existing direct application listener to obtain the real deployed DOM and renderer without borrowing a logged-in user browser. That listener does not terminate Fleet's authenticated terminal upgrade, so terminal status was `connecting` then `ended`. The grid measurements and temporary padding experiment are real browser layout evidence, not a mock, but are not evidence of a connected PTY or reduced remote resize-message count. Connected end-to-end acceptance remains an explicit apply gate using an independently authenticated context and an owned disposable Pane. The measurements do not assert the operator's actual font choice or physical-device metrics.

Apply acceptance subsequently used an independently configured TLS Gateway, native bridge and isolated multiplexer with disposable Panes and an app-issued synthetic session. The actual PTY matched 50, 62, 168 and 136 columns at the four measured viewports. Header text, controls and their rectangles matched across both surfaces, not just their height. Find kept its query and focus while new PTY output changed the match count from 2 to 4, and Zen and native Pane actions remained functional. No font preferences changed.

## Goals / Non-Goals

**Goals:** one native Pane header owner across surface switches; a small fit-aware inset using the existing gutter convention; preservation of native actions, current font behavior, responsive bounds, and necessary resizing.

**Non-Goals:** no separate terminal header, no mirrored copy of header JSX, no font repair, new font setting, column offset, hidden/clipped terminal, general surface framework, backend session work, new service, dependency installation, release, or peer rollout. Do not promise zero resize: content height, rail geometry, cell rounding, font settlement and shared-terminal ownership remain real causes.

## Decisions

### Keep the native Pane frame and add a content slot

Change the owned `FleetPaneRoute` to render `DetailRoute` for both modes. Add one optional, typed content-renderer port to `DetailRoute`, forwarded to `AgentChat`. Its absent/default path is the current native mirror. Its supplied path renders fork-owned `FleetTerminal` in place of the mirror/composer content, while `AgentChat` remains the owner of the existing `RouteHeader`, identity/action state, `PaneActionsSheet`, Find override and navigation callbacks. The Pane key remains its full scoped identity, never the surface choice.

Remove `FleetTerminalRoute`'s separate metadata/navigation mapping and `FleetTerminal`'s `RouteHeader`/label/onBack responsibility. Do not add a new header component just to make terminal mode look similar. Keep `AppHeaderHost` and `RouteHeader` unchanged: their portal, sizing, safe-area, status and accessibility conventions already work. Keep terminal status and geometry inside the replacement body.

The slot is a local extension of the existing component boundary, not a global context/store or a new router. The native frame receives no terminal-session implementation. Its renderer contract supplies the existing Find state (`open`, query, focused match, match-count update), rendered-output availability, and Zen visibility so the body can implement the controls it already exposes. Define that small view contract at the native component boundary and import its type in the owned terminal renderer. Avoid a selector/string mode that teaches the upstream component ttyd vocabulary.

`fleetPaneLoader` continues to return its no-text terminal data, so keeping the native frame does not resume mirror reads. On terminal-to-mirror transitions revalidate the existing Pane loader once, through the existing route/revalidator convention, so the native body receives fresh text rather than the terminal stub. Do not expose stale mirror text from a previous Pane. Mirror polling, grammar, manual fit and composer remain their original default path; terminal mode must not mount a hidden mirror/composer or trigger their writes. Only content-local state is reset at a surface change; native header identity and action semantics remain owned by the same frame.

**Rejected:** duplicating native header JSX into `FleetTerminal` would duplicate future fixes and controls; extracting only the label styling would retain the missing actions; deleting mirror header features would satisfy dimensions by regressing the product. Moving all of `AgentChat` into a new framework spends far more upstream boundary than the slot.

### Preserve every existing native header action

Keep native `PaneActionsSheet`, `HeaderStatus`, `FindBar` and existing action rows. Identity opens the same scoped Space; History uses the same agent-session availability and scoped route; rename/close/show-in-terminal retain existing confirmations, permission gates and audit behavior. Runtime testing must never activate show-in-terminal against somebody else's Pane.

The visible-output actions cannot be wired to the terminal loader's empty mirror text: that would silently remove Find and Zen. Let the content renderer report whether it has rendered output, and direct the existing Find state to the visible body. In terminal mode, read only xterm's existing bounded buffer for a requested search, reuse `lib/find.ts` substring semantics, map matches through buffer cells (including wide and combining characters and wrapped rows), and select/reveal the active match with xterm's public APIs. Keep this adapter fork-owned under `fleet/ui/terminal/`; do not fetch a hidden mirror, start a second parser of the live wire, pause the terminal connection, or build a second search UI. No buffer copying is needed while Find is closed. Count/next/previous/close and focus restoration must be functional, not a no-op callback that merely keeps a row visible. Query/selection from one Pane must not reach another.

Zen keeps its current preference and escape/exit convention. Hiding the native chrome must leave the visible terminal fitted to its new real body and retain a reachable exit; it must not dispose the session merely because the header is hidden. This is compatibility work required by the AppBar request, not a new terminal-control catalog.

### Match the mirror's gutter inside the terminal fit host

Add `px-2` to `fleet-terminal-host`, retaining its bounded flex layout and the retained child's `h-full w-full`. The host's border-box remains the native route width; its content box and the retained child's computed width shrink by 16px. FitAddon therefore measures the real narrower parent without manual arithmetic or private xterm APIs. The experiment above exercised this exact placement.

Do not put padding on the retained `w-full` element while leaving its computed border-box at full width: FitAddon reads that element's width rather than subtracting its padding. Do not pad only a screen overlay or use `cols - 2`. Do not use `ch` on the host, whose inherited face is app chrome rather than the terminal face; fixing that would needlessly change font inheritance. The existing 8px gutter is 2.67 cells at the measured 10px default and approximately two cells at common larger text sizes; exact cell equality is not the requirement. Matching the actual mirror convention removes the measured 2–3-column difference without tuning a new token to one font.

Preserve the `report → fit → displayed geometry` path, existing resize deduplication, observation and font-load listeners. No resize suppression, extra debounce policy, font preloading, preference migration or terminal font resolver change is needed.

### Report only from the current drawable host

The approved refinement guards the report owner and geometry source, not any particular dimensions: the host must still be in the document, its retained entry must belong to the current mount, and its retained child must have positive client width and height. A queued former observer cannot resize a held terminal, and a zero-area host has no fitted viewport. Restore/remount still reports immediately through the existing path, including valid minimum-size viewports.

The observed zero-area case was produced by the browser screenshot tooling: a still-connected host briefly became only its 16px padding wide and zero high, with a 0×0 retained child, then recovered. That tooling artifact is distinct from the user's original surface-width difference and is not evidence that ordinary users routinely encounter zero-area layouts. A deterministic detached-callback regression and a zero-area-to-positive-area regression both failed before their guards and passed afterward. Repeating the actual screenshot scenario then emitted no spurious minimum-geometry report; real viewport and animated rail-size reports remained intact. No wheel or scrollback policy changes belong to this refinement.

### Ownership and integration boundary

Implementation owner:
- `web/src/components/fleet-pane-route.tsx` and `.test.tsx`.
- `web/src/components/fleet-terminal.tsx` and `.test.tsx`.
- The optional content port and its focused regressions in `web/src/routes/detail.tsx` / `.test.tsx` and `web/src/components/agent-chat.tsx` / `.test.tsx`.
- A terminal-buffer Find adapter and focused edge regressions under the already-owned `fleet/ui/terminal/` root if the buffer mapping does not fit cleanly in the existing component.
- This change directory only; no other active planning artifacts.

Coordinating owner, after review and serialized against the acquisition change:
- `FORK.toml`: declare `detail.tsx` and its test as a narrow content-renderer forwarding port, and extend the existing AgentChat entry rather than adding a second classification for that path. Existing owned terminal files need no new path classification. No upstream header/style path is needed.
- `docs/herdr-fleet.md`: update the terminal presentation paragraph without touching the acquisition policy paragraph concurrently.
- `CHANGELOG.md`: one short Unreleased line after behavioral proof.
- `openspec/specs/fleet-pane-terminal/spec.md`: synchronize this added layout requirement only after the other change's acquisition delta has been reviewed and synchronized. This delta does not replace or duplicate those requirements.

Never edit `fleet/terminal/{session,connection,service,spawn}.ts`, their tests, `AGENTS.md`, `.adr/`, font files/resolvers/preferences, versions or unrelated scratch files for this change.

## Risks / Trade-offs

- A common frame can accidentally keep mirror requests/effects alive in terminal mode → keep the no-text loader, omit the native content subtree, and observe requests and writes during switch/resize tests.
- Retaining the native header can accidentally hide output-dependent actions through empty terminal data → explicit current-body availability/search contract and real interaction acceptance; no removed features to obtain parity.
- Search indexes are text offsets while terminal selection is cell-based → map through public buffer cells and protect wide/combining/wrapped cases with focused behavioral regressions, without changing glyph rendering.
- Matching padding does not guarantee every font/scrollbar has identical columns → record actual cell metrics, usable widths and rounding, and make only a measured alignment claim.
- Geometry proof is currently disconnected → do not claim remote resize reduction until an authenticated owned-Pane run observes the real viewport path.
- Shared manifest/docs/spec targets can collide → coordinating owner serializes those mutations; no archive or index ownership in this planning pass.

## Migration Plan

No stored data, font preference, wire contract, package dependency or version changes. Review all artifacts before apply. Implement the native body port and terminal inset, then exercise the actual application at phone and desktop sizes with independent browser state and disposable resources. Record before/after header controls and bounds, usable widths, cells, columns, rows, and connected resize observations. Keep necessary terminal status visible. Run focused affected verification after coordinated UI edits settle; project-wide release gates remain the coordinator's work.

After proof, the coordinating owner integrates public documentation, boundary inventory, changelog and serial canonical spec sync. Archive/publication/deployment require the separate approved gate; none happens in this planning pass. The eventual change is frontend-only and therefore patch-axis by itself, but no release is cut here and any later release must assess all then-landed changes. Rollback is the previous frontend build, with browser preferences and terminal backend unchanged.
