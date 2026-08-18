# 0011 — Manual width fit retains a non-takeover controller

Status: **Accepted** (2026-08-18)

Narrowly supersedes the terminal-`control` refusal in [ADR 0008](./0008-collie-does-not-run-a-terminal-emulator.md).
ADR 0008's no-emulator and `pane.read` rendering decisions remain accepted.

## Context

Collie receives rows after Herdr has rendered them at the real PTY width. CSS wrapping can make those
rows fit a phone, but it cannot reconstruct prose or a TUI that the upstream application already
laid out at a desktop column count. The operator explicitly chose the corresponding trade-off: a
button may change the same shared PTY the desktop Herdr client displays, but browser/layout changes
must never do so automatically.

Herdr 0.8.0 has exactly one supported primitive with those semantics: a writable
`terminal session control` stream. It requires columns and rows, grants only one controller input
and resize ownership, accepts later NDJSON `terminal.resize` commands, and restores the application
Pane size when that controller disconnects. Consequently a one-shot subprocess produces only a
momentary resize. `--takeover` would make the action surprising and could evict a deliberate direct
attach.

The Display drawer itself temporarily reduces the browser terminal's height. Measuring both axes
there would make a width-fit button also shrink the PTY rows. Herdr already reports the authoritative
`scroll.viewport_rows` in the Pane snapshot, so the bridge can preserve height without exposing or
asking the browser to choose it.

This project periodically merges an exact upstream Collie release. The feature therefore needs a
boundary a future maintainer can find before resolving conflicts in Display, Composer, or Pane code.

## Decision

Add one owner-maintained **Resize · Custom** action immediately below **Text size** in Pane Display
Settings.

- `AgentChat` measures the existing mirror scrollport content width at the active monospace font
  size only inside the click handler. It derives bounded complete columns and sends only `cols` to
  the normal session-scoped Pane API.
- The bridge retains `viewport_rows` as server-only state and pairs it with those columns. If that
  geometry is unavailable it fails explicitly; it never invents a default height.
- One manager starts `HERDR_BIN_PATH` (or `herdr`) with the selected runtime's exact
  `HERDR_SOCKET_PATH`, Pane id, columns, and preserved rows. It considers acquisition successful only
  after the first frame, drains all output, and keeps the child alive. Later clicks for the same
  socket/Pane write `terminal.resize` to that process.
- Never pass `--takeover`. Report controller conflicts through Collie's existing status surface.
- Treat resize as an existing write-level action: Host/Origin/device checks, session Map lookup,
  busy state, and audit attribution all apply. Release/terminate retained controllers on bridge
  shutdown; terminal/session/Panes closing make their streams exit and remove their leases.
- Do not add ResizeObserver/window listeners, Fleet controls/messages, controller input, rendered
  frame handling, or a terminal emulator.

The fork marker is both visible (`Custom`) and textual (`WEB REMOTE CUSTOM` comments). During a
future exact Collie merge, reconcile these isolated paths deliberately:

- UI seam: `web/src/components/{agent-chat,composer,display-prefs}.tsx`,
  `web/src/lib/{api,terminal-resize,types}.ts`, and their focused tests.
- Bridge seam: `bridge/{index,server,state-engine,terminal-resize,types}.ts` and focused tests.
- Contract/history: this ADR, `HERDR_API.md`, and the 2.3.0 changelog.

Do not treat an upstream refactor of these paths as permission to silently drop the capability. Move
the small seam onto the new structure, or deliberately remove it with a new decision and release
note.

## Consequences

- The phone can request genuinely narrower application layout instead of applying a second visual
  wrap to already-rendered rows. The desktop Herdr view changes width too; that is chosen behavior.
- A manually resized Pane consumes one lightweight child/controller until the Pane/session/server or
  Collie bridge ends. Frame bytes are drained and discarded, so memory is bounded by stream chunks
  and the existing mirror remains `pane.read`-based.
- A competing direct controller makes Resize fail rather than evicting it. The operator can release
  that controller and click again.
- Height remains what Herdr reported, even though the open Display drawer makes the phone mirror
  temporarily shorter.
- The upstream fork surface spans three UI components plus one helper/API seam and a compact bridge
  manager. It is larger than CSS-only wrapping but smaller than a Herdr patch, Fleet protocol, or
  emulator, and every non-upstream piece is enumerated above.
