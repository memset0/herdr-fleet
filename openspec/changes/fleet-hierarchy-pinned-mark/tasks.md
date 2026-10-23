## 1. Model and derivation

- [x] 1.1 Add optional `pinned` to `NavigationPaneInput` and `NavigationRow` in `fleet/ui/native-navigation/model.ts`, copied by `paneRow` so the merged single-Pane row inherits it; verify with `model.test.ts` cases for a pinned pane row, a pinned merged row, and an unpinned row
- [x] 1.2 In `native-navigation-shell.tsx`, derive `pinMatcher(usePins())` before the tree and set `pinned` in `toNavigationPane`; the tree memo depends on the matcher; nothing is sent anywhere

## 2. Row mark

- [x] 2.1 In `native-navigation-tree.tsx`, draw a pinned row's title bold and a `ui/badge` "pinned" after it (`ft("fleet.navigation.pinned")`), badge `shrink-0`, title `truncate`, state dot still trailing; add the key to all seven Fleet locale files
- [x] 2.2 Tree test: a pinned pane row and a pinned merged row render bold with the badge before the state dot; an unpinned row renders neither
- [x] 2.3 Shell test: toggling a pin through Collie's store adds and removes the mark live

## 3. Verification and audits

- [x] 3.1 Add the CHANGELOG `[Unreleased]` line; run root and web typecheck, `bun run lint`, and the focused web tests above
- [x] 3.2 Run `bun scripts/check-fork.ts` and `bun scripts/check-private-facts.ts`; confirm no upstream-owned path changed and `FORK.toml` needs no entry
- [ ] 3.3 Confirm on the lead: build and check a pinned, a merged-pinned and an unpinned row visually
