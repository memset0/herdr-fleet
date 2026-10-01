## Context

See proposal.md for the audit findings. Baseline is Collie v1.14.2. The rail, its rows, its footer,
the surface switch and the shell are fork-owned; Collie's `index.html`, `agent-list.tsx`,
`agent-card.tsx`, `agent-chat.tsx`, `strips-summary.tsx` and the seven dictionaries are upstream and
reachable only through ports already declared in `FORK.toml`.

## Goals / Non-Goals

**Goals:** one visual language for one object (a pane row); one pin mechanism; no new invasive port;
the measurable targets the owner set (44px rail rows, CJK glyphs from the selected fallback, toggle
contrast ≥ 4.5:1, footer rule level with the tab bar's, pane column at 1280px wider than at 1024px).

**Non-Goals:** changing Collie's pin store, its Pinned group, its hold gesture or its sheet; adding a
pin row to the fork's pointer context menu; the zh "Effort" label (Collie's wording).

## Decisions

### D1. The CJK hole goes into the unlayered layer, in the stylesheet that loads last
Collie's `index.html` re-declares the default `--font-sans` in an inline, unlayered `:root` block for
the boot splash. Unlayered beats Tailwind's `@layer theme`, so the fork's hole in the `@theme` stack
never reached a running page in the default face. The built stylesheet `<link>` follows the inline
`<style>` in `<head>`, so an unlayered `:root { --font-sans: … }` in `index.css`, beside the existing
`--font-cjk` default (the declared `index.css#--font-cjk` anchor), wins on order at equal
specificity. `:root.font-*` blocks are (0,2,0) and still win for every other typeface choice.
*Alternative rejected:* editing `index.html` — a second invasive path for a fact `index.css` already
states. The splash keeps Collie's stack: it is painted before any fallback face is fetched.

### D2. Favourites are Collie's pins; the fork store is retired
Collie 1.12 introduced per-device pins with their own Pinned group (ADR 0070); the fork's favourites
had become a second, weaker way to say "this one matters". The star now calls Collie's `setPinned`.
On the dashboard the port shrinks: `agent-list.tsx` no longer subscribes to a fork store or
partitions groups — it passes `isPinned(a)` and a toggle built by `web/src/lib/fleet-roster.ts`
(`togglePanePin`), still through the `agentFavoriteStore` anchor line, re-pointed to a surviving
comment. `agent-card.tsx` is unchanged. Dictionary keys `home.favorite.add/remove` stay (they are the
port's anchors) and their values become "Pin {name}" / "Unpin {name}" in all seven languages, using
each dictionary's own word for Collie's pin.
*Focus:* a pin moves the row between groups and React remounts it; `togglePanePin` re-focuses the
row's star after the commit by the row's DOM id on the dashboard. The rail cannot use ids (its rows
are mounted twice — rail and switcher sheet — and the rail stays mounted while hidden), so it
re-focuses inside its own container by row key.

### D3. Migration is one-shot and only against a fresh snapshot
`fleet/ui/agent-favorites.ts` becomes a legacy reader (`readLegacyFavorites`, `forgetLegacyFavorites`)
with the old bounds and parser. The shell runs `migrateLegacyFavorites(data.agents)` from an effect
when the snapshot is fresh (`!data.error`) and lists at least one Agent: every stored tuple matching a
live Agent by host, session, pane id and agent becomes a pin via `setPinned`, then the key is
removed. Unmatched favourites are dropped (a pin needs the workspace name only a live row has). An
unreadable record is removed with nothing pinned. Both keys are per browser, so the migration needs
no server.

### D4. The roster gains a Pinned section and loses the favourite partition
`fleet/ui/pane-roster.ts` takes `pinned` entries (already in Collie's order) and drops them from the
triage sections, so the rail, the command bar, `next-agent` and `select-agent-N` keep one order:
Pinned, needs, ready, working, recent, then shells (command bar only). `RosterEntry.favorite`
becomes `pinned`. The Pinned order is Collie's `pinnedRows` over `groupPanesByWorkspace(…, { order:
"fixed" })`, computed once in `fleet-roster.ts` (`pinnedAgents`) for both callers, so the rail needs
the snapshot's tabs and servers.

### D5. Rail row anatomy
Leading slot: a 12px-wide ordinal (`text-xs`, reserved even past the ninth row so names align), then
Collie's `StatusDot` (`glide="dot"`), then `AgentIcon size-4` (`glide="tile"`). Line 1: Space (muted,
capped at 45% like Collie's switcher row's space) · name (`font-medium`, 16px, `data-glide="name"`),
`UnseenMark on={isUnseen} reserve`. Line 2 (`h-4 text-xs`): `PaneMeta` (host · cache · session), what
the pane is doing, age at the end. Collie's dashboard row ends line 1 with `PaneMeta`; the first
visual pass showed a 320px rail truncating both the Space and the name to a few letters with the host
tag on line 1, so the meta leads line 2 instead — the same component, one line lower. Row `h-11 py-0 pr-12`.
The `data-glide` names are inert until a row is made a glide origin; they keep the anatomy equal to
Collie's so that wiring would need no markup change. The `data-slot` stays `native-agent-card`: the
fork already put `agent-row` on Collie's dashboard button and the e2e tier selects it there, so
reusing it for rail rows would make those selectors ambiguous.

Cards only for the section whose triage record carries `accent` (Collie's alert mark — `needs`).
Ready·unseen rows are flat with the unseen mark, as on Collie's dashboard. The Pinned group is one
flat `ListGroup` under Collie's muted `SectionHeader`. Triage headings take `tone="strong"`.

The current pane comes from the shell (`rosterEntryKey(currentPane)`) as `currentKey`; the matching
row gets `aria-current="page"` and `bg-accent text-accent-foreground`, Collie's switcher idiom.

### D6. Summary line: the dashboard's own component and predicate
The rail renders Collie's `StatusSummaryLine` over every Agent with `allClear` = no Agent in an
`ATTENTION` bucket — exactly the dashboard's `allClear`. The fork's own `needs`-only check is gone.

### D7. Footer and switch
`FleetPaneSurfaceToggle`: `role="radiogroup"` container `flex gap-1 p-2`, segments `flex min-h-11
flex-1 items-center justify-center rounded-md px-3 text-sm font-medium`, selected `bg-primary
text-primary-foreground`, else `text-muted-foreground hover:bg-muted active:bg-muted` (Collie's
`theme-control.tsx`). `FleetNavigationFooter`: the build identity becomes a `min-h-14 border-t
border-rule bg-background pb-[env(safe-area-inset-bottom)]` row, the tab bar's band; the rail's own
footer wrapper no longer pads the safe area (the row does). On a route without the tab bar the row
still reads as the footer's base.

### D8. Breakpoints
The Agents rail and its separator move from `xl:` to `2xl:`; the hierarchy rail stays at `xl:` and
carries `max-2xl:max-w-[calc(100vw-66.25rem)]`, so at 1280px it draws at most 220px (its own minimum)
and the route column is 1056px. `agent-chat.tsx`'s switcher stand-down query moves from `80rem` to
`96rem` (existing native-manual-pane-fit-port line), so between 80rem and 96rem the Pane page offers
its Switch pill holding the Agent surface. The overlay and header trigger stay at `xl`. The
separator's `aria-valuenow` keeps reporting the preferred width; the cap is a viewport fact, not a
preference, and dragging past it is harmless.
*Alternative rejected:* hiding the hierarchy rail too below 2xl — it would leave 1280–1535px with no
persistent navigation at all, and the owner asked for one rail to yield.

### D9. Pane chrome
The tab row's trailing `StatusBadge` and the folded bar's trailing `StatusWord` are removed from
`agent-chat.tsx`; `strips-summary.tsx` returns byte-for-byte to v1.14.2, so `native-pane-chrome-port`
keeps only `collie-home.tsx#paper`. The fold chevron stays removed (automatic fold, spec unchanged).

### D10. Headings
Rail titles and the drawer title: `text-sm font-semibold text-foreground` (Collie's `sheet-title`).

## Risks / Trade-offs

- [A user's stored favourites on an unreachable member are dropped by the one-shot migration] → The
  migration waits for a fresh snapshot with Agents; a member down at that moment loses its favourites,
  which a hold or the star restores in one act. Accepted; recorded in the CHANGELOG line.
- [16px names in a 280–320px rail truncate sooner] → The Space truncates first; the name keeps the
  remaining width; the ordinal and dot are fixed columns.
- [Right rail appears only from 1536px] → Between 1280 and 1535 the Switch pill is the Agent surface,
  one tap away; the command bar and `select-agent-N` still address the same roster.
- [Pinned rows leave the triage sections] → Section headings still count every pane of the bucket,
  Collie's own "no two headings count one pane" rule.

## Migration Plan

Frontend bundle only; the lead's rebuild makes it live. Rollback is reverting the commits; the pins
the migration wrote stay valid Collie pins.

## FORK.toml

No new port. `native-agent-favorites-port`: anchor `agent-list.tsx#agentFavoriteStore` re-pointed to
the surviving port comment, verify list names the legacy reader's test, reason updated (favourites are
pins). `native-pane-chrome-port`: `strips-summary.tsx#trailing` removed. `native-navigation-sidebars-port`
reason: the rail now honours pins, so the pinned-panes switcher e2e case is re-examined.
