## Why

The fork's right-hand Agents rail lists every Agent across the pack, and a finished pane the operator
has not opened carries Collie's unseen mark until it is opened. After a burst of background work the
operator often already knows what finished and wants the marks gone without opening each pane in
turn. Collie has no "mark all" action; it marks one pane seen when the page reads that pane.

Investigating the mechanism also showed that the authenticated Gateway does not forward the header
that carries that signal, so behind the Gateway a pane read never marks a pane seen at all — only a
write to the pane does.

## What Changes

- Baseline: Collie `v1.15.0`, as recorded in `UPSTREAM.md`; this change adopts nothing.
- The Agents rail's header gains a "Mark all seen" control beside the summary line. It is drawn only
  while at least one pane in the rail's roster — every host — is unseen by Collie's own rule, shows
  how many, and on activation marks each of those panes seen through Collie's existing per-pane
  signal: a pane read carrying Collie's seen header, sent to the pane's own host and session. The
  reads run in a small parallel batch; then the route data is revalidated, so the rail, the
  dashboard and the summary line update from the next snapshot. The control is disabled while the
  batch and its revalidation are in flight, is a real button reachable by keyboard, and is labelled
  in all seven dictionaries.
- The Pane page's switcher sheet, which holds the same rail element below the rail's breakpoint,
  gets the same control with no further code.
- The Gateway's upstream request-header allowlist gains Collie's seen header, which carries no
  credential or identity, so a pane read the page marks as looking at the pane reaches Collie as
  such — for this control and for ordinary pane opens.

Non-goals:

- No new bridge route, no batch endpoint, no change to how Collie derives or stores unseen state,
  and no edit to an upstream-owned file beyond the existing dictionary declaration.
- No per-host or per-section "mark seen"; no undo.
- No release and no tag.

Reused upstream behaviour: `isUnseen`, the seen header and `ActivityLedger.noteSeen`, the crew
forwarder that already carries the header to a peer, `fetchPane`, `paneScope`, route revalidation.
Fork-owned behaviour: the rail control, the batch helper, the Gateway allowlist entry.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-native-navigation-sidebars`: the Agents rail offers a one-tap control that marks every
  unseen pane seen.
- `fleet-public-authentication`: the Gateway forwards Collie's seen header to Collie.

## Impact

- Code: new fork-owned `web/src/lib/fleet-mark-seen.ts`; `web/src/components/native-agent-rail.tsx`
  (control and in-flight state); `web/src/components/native-navigation-shell.tsx` (passes the
  marking callback); `fleet/proxy.ts` (one allowlist entry); new keys in the seven dictionaries
  (already declared under `native-agent-favorites-port`).
- Tests: `native-agent-rail.test.tsx`, `native-navigation-shell.test.tsx` (the switcher's copy),
  a unit suite for the batch helper, `fleet/proxy.test.ts`.
- Boundary: the new helper and its test join an existing owned entry; no new invasive path.
- Release axis when cut: PATCH (frontend bundle and the lead's Gateway only).
