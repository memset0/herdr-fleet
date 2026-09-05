## Why

Two things the keyboard layer got wrong are only visible with a hand on the keys, and both were
reported from use rather than found in a test.

A shortcut ends with the caret nowhere. The capture listener consumes the key, the command runs, and
focus is left on `body` — so the next character the operator types is simply lost, and every command
is followed by a reach for the mouse. Collie never had this problem because Collie had no global
keyboard layer; the layer is the fork's, and so is the obligation to give the caret back.

The Pane switcher searches one field. A Pane is named by four facts — the machine it is on, its
Space, its Tab and its own name — and an operator opening the switcher is usually holding one of the
other three ("the one on the other box", "the one in the deploy tab"). Matching only the Pane's own
label makes the switcher unusable for exactly the questions a pack makes common.

## What Changes

- Every Fleet command ends by returning the caret to the composer: to the SAME offset when it was
  there when the key was pressed, and to the END of the field when it was not. A command that moved
  the operator to a different Pane always lands at the end, because the offset it captured belonged
  to a draft that is no longer on screen.
- The return SETTLES rather than fires once, so a Pane the operator has just switched to gets the
  caret when its composer finally mounts — and it never takes the caret away from an operator who has
  already started typing.
- A Fleet panel outranks it: while a rename, a confirmation or the command bar stands, that surface
  owns the caret. When one closes with nothing to hand the caret back to, the composer gets it.
- Pane mode matches on all four facts, not one: the Pane's own name, its Space, its Tab and its host.
- A row matched on its Tab or its host says so, in the single context slot it already had — the same
  element showing a different string, so the row answers "why is this here?" without growing.

Non-goals: no new binding, no catalog entry, no change to the roster's order or to what the right
rail draws, and no change to how a Pane is opened.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-keyboard-commands`: adds a requirement that the dispatcher returns the caret to the
  composer, with the offset rule, the moved-Pane rule and the panel's precedence.
- `fleet-command-bar`: Pane mode's fuzzy match covers the four facts that name a Pane, and the row
  shows the one it matched.

## Impact

- Fork-owned: `web/src/lib/fleet-composer-focus.ts` (new), `web/src/components/fleet-commands.tsx`,
  `web/src/components/fleet-panel.tsx`, `web/src/components/fleet-command-bar.tsx`,
  `web/src/lib/fleet-roster.ts`, `fleet/ui/pane-roster.ts`.
- Upstream-owned: none. The composer is reached through the `data-slot="chat-input"` attribute it
  already carries, and `AgentView.tabLabel` is a field the bridge already denormalises — so this
  spends no new invasive path and `FORK.toml` is unchanged.
