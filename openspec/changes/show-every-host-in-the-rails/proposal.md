## Why

The lead now merges a real pack: its snapshot carries workspaces, tabs, panes and agents from every
member, each tagged with the host it lives on. Both fork-owned rails still show one machine. They are
fed `ambientPanes`, whose job is to narrow rows to the address the URL is on, and the hierarchy model
takes a single host id by construction — choices that were right while a Fleet install was one
machine by definition and are now the only reason a pack looks like a solo.

## What Changes

- Make the hierarchy rail present every member: one collapsible Host item per host, each over its own
  Space/Tab/Pane rows, in a stable order with the lead first.
- Make the Agent rail list agents from every member, and mark each row with the host it came from,
  reusing Collie's own host chip so a solo install shows no marker at all.
- Open a row with its own host and session rather than the one the URL happens to carry, so a row
  belonging to another member navigates to that member.
- Leave a solo install byte-identical: one host, one Host row, no marker, the same rows in the same
  order as before.

Non-goals:

- Any change to the merged snapshot, the Pack wire, reachability, or which hosts exist.
- Per-host filtering controls, reordering, or a host switcher; the rails present what the snapshot
  reports.
- Collie's own dashboard, space view and pane sheet, which already carry the host dimension.
- Presenting an unreachable member's rows differently from how the snapshot already marks them.

## Capabilities

### Modified Capabilities

- `fleet-native-navigation-sidebars`: Both rails present every host in the pack rather than only the
  ambient one, with each Agent row marked by its host.

## Impact

- Changes the fork-owned navigation model, the two rails and the shell that feeds them, plus their
  focused tests, under `fleet/ui/**` and `web/src/components/**`.
- Reuses Collie's existing host helpers and host chip; adds no new host concept and no dependency.
