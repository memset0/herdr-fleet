## 1. Font stack

- [x] 1.1 Add the unlayered default `--font-sans` with `var(--font-cjk)` at the `index.css#--font-cjk` anchor, matching Collie's current default stack
- [x] 1.2 Extend `web/src/fonts.test.ts` or the webfont test to pin the unlayered default stack's fallback position

## 2. Favourites become pins

- [x] 2.1 Replace `fleet/ui/agent-favorites.ts` with the legacy reader and its root test
- [x] 2.2 `fleet/ui/pane-roster.ts`: Pinned section first, pinned entries leave triage sections, `favorite` → `pinned`; update its test
- [x] 2.3 `web/src/lib/fleet-roster.ts`: `pinnedAgents`, `togglePanePin`, `migrateLegacyFavorites`; update its test
- [x] 2.4 Dashboard port: `agent-list.tsx` star reads and toggles pins, favourite partition removed; update `agent-list.test.tsx`, `agent-card.test.tsx`, `home.test.tsx`, `stable-order.test.tsx` as needed
- [x] 2.5 Dictionaries: `home.favorite.add/remove` values become pin wording in all seven languages
- [x] 2.6 Shell: run the one-shot migration on a fresh snapshot; roster from pins

## 3. Rail rows and groups

- [x] 3.1 `native-agent-card.tsx`: 44px anatomy, ordinal slot, StatusDot, size-4 icon, 16px/500 name, text-xs meta, UnseenMark, PaneMeta, data-glide parts, 36px star, current marker, cards for the accent section only
- [x] 3.2 `native-agent-rail.tsx`: Pinned group, strong headings, StatusSummaryLine with the dashboard predicate, currentKey, focus follows the star
- [x] 3.3 Update `native-agent-rail.test.tsx` with density, current marker, Pinned group, summary wording and star-contrast/size assertions

## 4. Footer, switch, headings, breakpoints

- [x] 4.1 `fleet-pane-surface-toggle.tsx` as Collie's segmented control; update its test
- [x] 4.2 `fleet-navigation-footer.tsx` build row as the tab-bar band; rail/drawer footer wrapper
- [x] 4.3 Rail and drawer titles in sheet-title style
- [x] 4.4 Agents rail and separator at `2xl`, hierarchy rail capped below `2xl`; `agent-chat.tsx` stand-down at `96rem`; update `native-navigation-shell.test.tsx` and `agent-chat.test.tsx`

## 5. Pane chrome

- [x] 5.1 Remove the tab-row badge and folded-bar word from `agent-chat.tsx`; restore `strips-summary.tsx` to v1.14.2; adjust tests

## 6. Boundary and docs

- [x] 6.1 `FORK.toml`: anchors, verify lists, reasons; no new port; `bun scripts/check-fork.ts` green
- [x] 6.2 CHANGELOG `[Unreleased]` entries with bold leads
- [x] 6.3 `scripts/check-private-facts.ts` green

## 7. Verification

- [x] 7.1 Root and web typecheck, `bun run lint`, full web vitest, `bun run test:fork`, root tests touching `fleet/`
- [x] 7.2 Playwright smoke (Chromium) and the e2e files this change meets
- [x] 7.3 CDP visual pass on a mock-backed build at 1440/1280/1024/390, dark and light, with before/after measurements for items 1, 3, 4, 7, 8 saved under the audit's `after/`
