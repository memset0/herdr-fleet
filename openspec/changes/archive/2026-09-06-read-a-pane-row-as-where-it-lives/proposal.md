## Why

Three things are wrong with a Pane row in the switcher, and one of them is a plain bug.

**The host is named by its id, not its name.** The snapshot carries `{ id: "lead", name: "vultr" }`
and tags every lead Pane `host: "lead"`, so the row reads `lead` where the sidebar — which resolves
the same id through `hostName` — reads `vultr`. Two surfaces naming one machine differently is the
kind of disagreement that makes an operator doubt both.

**The emphasis is inverted.** The row leads with the Pane's own name, which is the least
distinguishing thing about it: a dozen rows read `claude`. What separates them is where they live,
and that is pushed to the right and truncated first.

**A match is marked by weight**, which reflows the line it is in — a subset of characters going
semibold changes their advance width, so the text around a match shifts as the operator types.

## What Changes

- **The host is named the way every other surface names it.** The roster carries the operator-facing
  name resolved through Collie's own `hostName`, and only on a pack — a solo install has one machine
  and naming it on every row is noise, the same reason the rails only tint hosts when there are
  several.
- **The row reads left to right as an address**: `space` in grey, then `tab`, then the Pane's own name
  in grey on the right, then the host as a tag.
- **The host tag is never marked.** It is where the row is, not what was typed.
- **A match is white with an underline**, at whatever colour the field is otherwise — and weight is
  no longer used, so marking a match never moves the characters around it. Light mode inverts to the
  same highest-contrast ink, because the token that means "white here" already means "near-black"
  there.
- Searching still covers all four facts, and the host is now searched by the name that is displayed
  rather than by the id that is not.

Non-goals: no change to the roster's order, to what a row does when activated, or to command mode.

## Capabilities

### Modified Capabilities

- `fleet-command-bar`: what a Pane row shows, in what order, and how a match is marked.

## Impact

- Fork-owned: `fleet/ui/pane-roster.ts`, `web/src/lib/fleet-roster.ts`,
  `web/src/components/fleet-command-bar.tsx`, `web/src/components/native-navigation-shell.tsx`.
- Upstream-owned: none. `hostName` and `isMultiHost` are Collie's own exports, already imported by
  the shell for the sidebar.
- The offset arithmetic that shifted a match's positions into a joined string is deleted, not
  changed: each field is now its own element and carries its own marks.
