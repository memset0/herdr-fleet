## Why

The exact Collie v1.2.0 baseline can display and control Herdr Panes but cannot explicitly fit the
shared PTY width to the currently visible terminal mirror. Reapply the v2 manual Resize capability
as an isolated native Collie extension without restoring iframe, shortcut, or automatic-resize
mechanisms.

## What Changes

- Add a Herdr-only `resizePane` capability and a protected session-scoped Pane resize endpoint.
- Retain the current Herdr viewport row count while applying a bounded operator-selected column
  count.
- Own controller acquisition, reuse, conflict reporting, and cleanup under `fleet/manual-pane-fit/`
  without takeover or browser-supplied socket paths.
- Add one explicit `Resize` row with a visible `Custom` badge immediately below `Text size` in
  native Display Settings.
- Measure the active terminal scrollport at the current monospace size and issue exactly one resize
  per operator activation, reporting through Collie's existing status surface.
- Record every minimal Collie capability/type/adapter/server/UI port in `FORK.toml`.

Non-goals:

- Automatic resize from viewport, drawer, font, layout, route, or browser changes.
- The old resize keyboard shortcut, command palette, outer Fleet shell, iframe, or frame protocol.
- tmux/zellij resize support, takeover of another controller, browser-selected socket paths, or a
  second generic mux API beyond the Herdr-only capability.
- Pack, multi-host trust, SSH, Gateway, notifications, ttyd, STT, release, production cutover, or
  any v2 modification/removal.

## Capabilities

### New Capabilities

- `fleet-manual-pane-fit`: Explicit native Display Settings action, safe width measurement,
  protected Herdr resize, viewport-row preservation, controller lease lifecycle, and feedback.

### Modified Capabilities

None. Collie's existing Display preferences, Pane routing, write authorization, audit, status, and
multiplexer behavior remain upstream authority outside the narrow fit ports.

## Impact

- Adds owned UI/backend modules under `fleet/ui/` and `fleet/manual-pane-fit/`.
- Adds narrow capability, Pane metadata, server route, API, Display Settings slot, and AgentChat
  wiring ports to Collie-owned files.
- Updates focused tests, typed i18n, `FORK.toml`, public docs, and `CHANGELOG.md`.
- Adds no dependency, automatic behavior, configuration field, public listener, or non-Herdr
  resize support.
