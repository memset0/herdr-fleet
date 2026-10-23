## Why

The real-terminal (ttyd) surface draws at Collie's Text size and font, but the operator cannot loosen
or tighten its lines or characters. The owner wants line and character spacing for that surface.

## What Changes

Baseline: Collie v1.23.3 as recorded in `UPSTREAM.md`; Fleet 3.24.0.

- Two per-browser settings, line spacing (xterm `lineHeight`, 1.0–2.0 in 0.05 steps) and character
  spacing (xterm `letterSpacing`, −1 to 4 px in 0.5 steps), default 1.0 and 0 so nothing changes
  until set. Stored values are bounded and snapped; anything malformed reads as the default.
- The rows stand in the Pane's Display sheet directly after Text size, only while Panes are drawn as
  the real terminal, beside the manual fit row that already fills that slot.
- A change updates the live terminal's options in place and re-fits it, so the new cols×rows reach
  the PTY through the ordinary viewport report; retained terminals are updated the same way on
  return. No reconnect, no rebuild.

Non-goals: no change to Collie's Text size, font, mirror or Chat typography; no server change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-pane-terminal`: terminal line and character spacing.

## Impact

Fork-owned only: `fleet/ui/terminal/spacing.ts` (+ test), `web/src/components/fleet-terminal-spacing.tsx`,
`web/src/components/fleet-pane-fit.tsx`, `web/src/components/fleet-terminal.tsx` (+ test), the seven
Fleet locale files, `FORK.toml` (one owned path; the existing Display slot entry's reason). Frontend
only, so a PATCH.
