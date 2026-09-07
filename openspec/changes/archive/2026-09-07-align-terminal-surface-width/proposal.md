## Why

Against Collie v1.5.2 (commit `cea2035e1f02d560d1bac66c85314828a7e01c20`), Fleet's terminal surface replaces the native Pane header contribution with a label-only contribution and omits the mirror's horizontal inset. Switching surfaces therefore loses Pane identity/actions and changes available columns; measured browser geometry shows the width difference is layout, not a reason to change fonts.

## What Changes

- Keep Collie's native Pane frame and its actual AppBar contribution mounted for either surface. Change only the Pane content through a narrow native content slot; remove FleetTerminal's separate header contribution rather than copying native header styles.
- Preserve the native identity, status/host context, overview navigation, actions menu, status announcements, Find, History, Zen, write gates, and focus behavior. Surface-specific output controls target the visible surface; functions are not removed from the mirror to make the two match.
- Add the mirror's existing `px-2` horizontal inset to the terminal's fit host: 8 CSS pixels on each side under the current spacing scale. The measured headless default cell is 6px, so this small 16px total inset removes two or three columns depending on rounding; it is approximately the requested two-character clearance, not an exact two-column subtraction.
- Keep terminal connection/status and dimensions inside terminal content, distinct from the shared AppBar. Preserve FitAddon, necessary viewport reports, font loading/remeasurement, and all font choices and preference storage.
- Report geometry only from the current mounted host with a nonzero content area; preserve the first real report after remount or layout restoration, including valid small viewports.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-pane-terminal`: One native Pane AppBar across both surfaces, functioning native controls, and small fit-aware horizontal terminal insets without changes to fonts or geometry ownership.

## Impact

- Owned UI: `web/src/components/fleet-pane-route.tsx`, `fleet-terminal.tsx`, and their focused tests. A narrowly scoped terminal-buffer search adapter may live in `fleet/ui/terminal/` to preserve the existing Find control without fetching mirror text.
- Native ports: `web/src/routes/detail.tsx` forwards an optional content renderer; `web/src/components/agent-chat.tsx` retains its native header/action owner and substitutes only content. Existing route and component tests cover the port; `FORK.toml` must declare the new route port and update the existing AgentChat port through the coordinating manifest owner.
- Public terminal documentation and one Unreleased entry are integrated after implementation, with shared-file ownership coordinated first. Canonical spec synchronization remains serialized with the active acquisition change.
- No backend/wire change, dependency installation, new service, font-family/fallback/preference change, visual redesign, release, peer deployment, or session-acquisition work. Width alignment reduces measured surface differences; it does not promise to eliminate every resize or the different row counts caused by different content.
- The proposal and drawable-host refinement have been approved for implementation. Archive, canonical synchronization, staging, commit, push and deployment remain separate coordinating-review gates.
