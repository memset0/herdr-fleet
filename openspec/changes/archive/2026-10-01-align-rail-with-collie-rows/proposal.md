## Why

A visual audit of the deployed 3.5.1 bundle against Collie v1.14.2 found the Fleet rails drawn in a
second visual language beside Collie's own rows: 57–63px rail rows in 13/11/9px type beside Collie's
44px rows, a favourite store that competes with Collie's own pins, a surface switch whose selected
segment fails contrast, a rail footer whose rule misses the tab bar's by 28px, a pane column that is
narrower at 1280px than at 1024px, a pane state spelled five times, and CJK glyphs in the UI face
drawn by the system's CJK font instead of the selected fallback. This change aligns all of it with
the rows, controls and type Collie already draws. Baseline: Collie v1.14.2 (`FORK.toml` upstream).

## What Changes

- **UI font stack**: the default face's stack gains the fallback position in the unlayered layer that
  wins over Collie's inline pre-paint mirror, so UI text in the default face reaches the selected CJK
  fallback. Other typeface choices keep their own stacks.
- **Agent rail rows** take Collie's row density: 44px rows, a leading status dot, a 16px agent mark,
  16px/500 name and 12px meta, Collie's unseen mark, Collie's host/cache/session meta, the `data-glide`
  part names Collie's rows carry, and the pane on screen marked `aria-current="page"` on the accent
  ground. The fork's two-line order (where, then what) is kept. Only `Needs you` rows are cards.
- **Favourites become pins (BREAKING for stored favourites)**: the star toggles Collie's own
  per-device pin state — one mechanism, two entry points (the star and Collie's hold/menu). The rail
  leads with a `Pinned` group, then the triage groups, each pane listed once. The fork's separate
  favourites store is retired; a stored favourite whose pane is live is migrated to a pin once, and
  the old key is deleted.
- **Rail summary line** is the dashboard's own (`Nothing needs you` only when no pane needs you or
  waits unseen), so the two never disagree.
- **Star control** is Collie's 36px round button with a 16px icon on a row reserving `pr-12`.
- **Surface switch** is Collie's segmented control (filled `primary` selected segment).
- **Rail footer**: the build-identity row is the tab bar's height, rule and ground, so the two rules
  meet on one line at the bottom of the screen.
- **Breakpoints**: the hierarchy rail stands from `xl`, the Agents rail from `2xl`; between them the
  hierarchy rail is capped so the route column never drops below 66rem, and the Pane page's own
  switcher entry carries the Agent surface.
- **Pane chrome**: the fork's state badge on the tab row and state word on the folded bar are
  removed; Collie's own dots and header mark are the state.
- **Headings**: rail and drawer titles use Collie's sheet-title style; rail group headings use
  Collie's workspace-heading voice (13px, own case), Pinned keeps Collie's muted caption.

## Capabilities

### New Capabilities

### Modified Capabilities
- `fleet-agent-favorites`: favourites are retired in favour of Collie's pins; the star toggles a pin; stored favourites migrate once.
- `fleet-native-navigation-sidebars`: rail row density and treatment, current-pane marker, Pinned group, summary wording, host meta, star geometry, footer alignment, surface switch style, headings, breakpoints and the collapse command's scope.
- `fleet-pane-chrome`: the fork's own pane-state badge and word are removed.
- `fleet-webfonts`: the fallback position must be effective for the default UI face despite Collie's unlayered pre-paint mirror.

## Impact

- Fork-owned: `web/src/components/native-agent-rail.tsx`, `native-agent-card.tsx`,
  `native-navigation-shell.tsx`, `fleet-navigation-footer.tsx`, `fleet-pane-surface-toggle.tsx`,
  `web/src/lib/fleet-roster.ts`, `fleet/ui/pane-roster.ts`, `fleet/ui/agent-favorites.ts` (replaced by
  a legacy reader), and their tests.
- Existing ports only, no new port: `web/src/index.css#--font-cjk` (native-webfont-port),
  `agent-list.tsx#agentFavoriteStore` / `agent-card.tsx#onFavoriteToggle` and the seven dictionaries
  (native-agent-favorites-port, anchors re-pointed where the old anchor text leaves),
  `agent-chat.tsx` (native-manual-pane-fit-port; breakpoint and badge removal),
  `strips-summary.tsx` returns to upstream byte-for-byte and leaves native-pane-chrome-port.
- Browser storage: `herdr-fleet:agent-favorites:v1` is read once and removed; `collie:pins:v1`
  receives the migrated pins. Nothing reaches the bridge.
- Release axis: frontend bundle only (PATCH-class); no release or tag is cut by this change.

## Non-goals

- No change to Collie's pin store, its Pinned group on the dashboard, its hold gesture, or its sheet.
- No pin row added to the fork's pointer context menu.
- The zh `Effort` belt label is Collie's wording and is left as it is.
- No new dependency, no backend or wire change.
