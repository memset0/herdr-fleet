## Why

Collie 1.5.1 caps the Pane and history screens at a 768px centred column above the phone breakpoint,
and this fork adopted that release. The operator noticed the result: the column between the rails
became narrower than the shell gives it.

Upstream's reason is sound where upstream lives and does not reach here. Their commit says an iPad in
landscape drew the Pane screen edge to edge while an 80-column mirror is only about 620px, so half of
a 1366px screen was empty. This fork fills exactly that space — with two navigation rails, which are
the whole reason the shell exists. The cap therefore applies a second time, inside a column that is
already bounded, and takes width from a mirror rather than from emptiness.

This repository had already decided the question. `fleet-native-navigation-sidebars` states that route
content fills the route column, and that **the Pane and history routes keep their existing full-width
presentation**. The tree stopped satisfying that sentence at the merge, and nobody noticed: the
adoption's preflight reports the ports a release disturbs, the Pane page's width had no port, so an
upstream decision walked in unopposed. Restoring the width is half the fix; the other half is making
the refusal a declared boundary, so the next release has to argue with it rather than inherit it.

## What Changes

- Restore the Pane and history routes to the route column's full width: their content wrappers drop
  the centring and the 768px cap, and their headers drop the matching `wide` claim and return to
  spanning the column, exactly as both did before the merge.
- Declare that refusal in `FORK.toml`, so `check-fork.ts --target <tag>` reports it the next time an
  upstream release touches those lines instead of the release quietly winning again.
- Sharpen the requirement it restores. "Keep their existing full-width presentation" described a tree
  where upstream had no cap; it becomes a rule stated against the cap that now exists upstream, so a
  future adoption has something explicit to check rather than a description of a tree that has moved.

Non-goals:

- Removing upstream's `wide` header claim. It stays where upstream put it, simply unclaimed by this
  fork's routes — declining to use an option is a narrower edit than deleting it, and a later fork
  surface may want it.
- Upstream's bottom-sheet cap from the same commit. Different surface, not this change's subject, and
  a sheet over a dimmed page is not a reading column.
- The phone presentation. Below the breakpoint upstream's change did nothing and neither does this.
- Anything about the terminal work active in this repository, which touches none of these lines.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-native-navigation-sidebars`: the requirement that route content fills the route column
  states the Pane and history routes' width as a rule rather than as a description of what upstream
  happened to do, and says that an upstream centred-column cap on those routes is declined.

## Impact

Upstream-owned, ported: `web/src/components/agent-chat.tsx` and `web/src/routes/history.tsx`, two
lines each — the content wrapper's classes and the header's width claim. `FORK.toml` gains the
boundary in the same commit: `agent-chat.tsx` is already attributed to `native-manual-pane-fit-port`
and the manifest allows one entry per path, so that half rides its reason; `history.tsx` is
attributed to nothing today and takes an entry of its own.

Not touched: `web/src/components/app-header.tsx`, whose `wide` claim upstream added and this change
merely stops claiming; `web/src/components/ui/sheet.tsx`, upstream's separate sheet cap; and every
route that was already declared full-width by the existing shell port.

Provenance of what is being declined: upstream `28255ae`, *"fix(web): the pane and history screens sit
in a centred column above phone width"*, adopted with Collie v1.5.1.
