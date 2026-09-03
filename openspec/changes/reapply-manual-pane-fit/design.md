## Context

See `proposal.md` and `specs/fleet-manual-pane-fit/spec.md`. Collie already owns Display Settings,
the terminal scrollport, display preferences, Pane routing, session resolution, write/device gates,
audit logging, multiplexer capability publication, and bridge shutdown. Herdr reports current
viewport rows but the generic Pane model currently drops that field. No resize route or retained
controller exists.

## Goals / Non-Goals

**Goals:**

- Keep geometry, request state, controller leases, validation, and result mapping in owned modules.
- Expose the smallest generic capability/metadata/slot/route ports Collie needs.
- Preserve rows and controller ownership with no takeover or guessed state.
- Make resize explicit-only and Herdr-only.

**Non-Goals:**

- Automatic resize, keyboard shortcuts, non-Herdr mux support, or generic controller APIs.
- Router, Gateway, Pack, SSH, notifications, ttyd, STT, or deployment mechanism changes.
- Changes to display preference persistence or Herdr source.

## Decisions

### 1. Split owned browser geometry from owned server controller state

Use `fleet/ui/manual-pane-fit.tsx` for measurement, busy/result state, the `Resize`/`Custom` row, and
one typed API call. Use `fleet/manual-pane-fit/` for request validation, trusted row lookup,
controller acquisition/reuse, resize execution, conflict mapping, and disposal. This keeps complex
downstream behavior out of Collie-owned components and server routing.

### 2. Publish a total `resizePane` multiplexer capability

Extend the existing capability record and browser mirror with `resizePane`. Herdr advertises it;
tmux/zellij and older adapters remain false through the existing total fail-closed declaration.
Display Settings gates the row from this capability plus the existing write-lock state.

### 3. Retain viewport rows as optional Pane metadata

Add optional `viewportRows` to the generic Pane model, copy Herdr's trusted
`scroll.viewport_rows`, and expose a server-only lookup through the state engine. The browser never
submits rows. Absence means unsupported/unknown and fails before acquisition.

### 4. Keep the server route thin

Add `resize` to the existing Pane route classifier and dispatch after the normal session, same-origin,
device-write, Pane-scope, and audit setup. The route parses only `{cols}`, calls the owned action,
and translates its closed result. No browser path selects a socket or controller command.

### 5. Retain one no-takeover controller per trusted socket and Pane

Key leases by the server-discovered Herdr socket plus Pane id. Start Herdr's terminal controller
without takeover, retain its exact child/connection handle, serialize requests per lease, reuse it
for later manual fits, and remove it on exit/failure. Dispose all leases during bridge shutdown and
session removal. Never identify or kill controllers by broad process lookup.

### 6. Measure complete cells only on click

The UI reads the current scrollport client width, computed horizontal padding, and one monospace
cell measurement only inside the click handler. It floors complete cells and clamps 20..500. No
observer, resize listener, effect, font subscription, or display-pref callback can send a request.

### 7. Add one native Display Settings extension slot

`DisplayPrefs` receives one optional row slot rendered immediately after Text size. `AgentChat`
constructs the owned manual-fit row from its existing scroll ref, display font size, Pane/session,
capability, and write-lock facts. This avoids placing Fleet logic in the generic settings component.

### 8. Extend existing owned and invasive boundaries

The existing `fleet-runtime` owned root already covers all new modules; extend its contracts/tests
instead of adding a child owned block. Add one exact invasive entry enumerating the capability,
Pane metadata, Herdr adapter, state lookup, server route/shutdown, browser API/type, Display slot,
AgentChat wiring, focused tests, and i18n ports.

## Risks / Trade-offs

- **[Controller takeover]** -> Never pass takeover and surface Herdr's refusal unchanged.
- **[Resize does not persist]** -> Retain and reuse the owned controller instead of fire-and-forget.
- **[Cross-session collision]** -> Key by trusted socket plus Pane id.
- **[Height corruption]** -> Use only positive trusted viewport rows and fail when absent.
- **[Lease leak]** -> Remove on child/socket exit and dispose on session/bridge shutdown.
- **[Unexpected automatic behavior]** -> Keep all geometry and API work inside the click handler and
  test rerenders/layout changes produce no request.
- **[Broad Collie fork]** -> Use total capability fields and one extension slot; keep action logic
  owned.

## Migration Plan

1. Add owned geometry/validation/controller modules with focused tests.
2. Add capability, viewport-row, state lookup, route, API, and shutdown ports.
3. Add Display slot and native manual action with i18n and focused UI tests.
4. Update `FORK.toml`, docs, Changelog, and OpenSpec artifacts.
5. Run focused gates during implementation and one full root/Web gate at commit readiness.
6. Push and deploy the exact candidate to isolated v3 staging for owner browser acceptance without
   touching v2 or other settings.
7. Roll back by deploying the previous exact commit; retained controllers terminate with the old
   bridge and no persistent data migration is needed.
