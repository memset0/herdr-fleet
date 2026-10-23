## 1. Plumbing

- [x] 1.1 Add optional `paneId` to the tab variant of `NavigationSubject` and set it in the single-Pane elision branch of `fleet/ui/native-navigation/model.ts`; verify with a `model.test.ts` case that a merged row's subject carries the Pane id and a multi-Pane Tab group row's does not
- [x] 1.2 Export `usePaneTagEditor()` from `web/src/components/fleet-pane-tags.tsx` returning the provider's opener (or null); verify by typecheck and its use in 2.x tests

## 2. Menu rows

- [x] 2.1 In `FleetPaneActions`, add Pin/Unpin (Collie pin store and strings) and Edit pane tags (non-shell only) above the write-gated rows; verify with `fleet-row-actions.test.tsx` cases: pin toggles the store, unpin reverses it, tags opens the editor for that pane without a write, shell shows no tag row, read-only still shows both
- [x] 2.2 Give `FleetTabActions` an optional `pane` and render the same two rows when present; verify with a test that a merged-row menu shows Tab rename/close plus Pin and Edit pane tags, and a group-row menu shows neither
- [x] 2.3 Resolve the merged row's Pane in `native-navigation-shell.tsx` and pass it (and the full pane herd, for both menus) to the row actions; verified by the model test (subject carries the Pane), the merged-row `FleetTabActions` test and both typechecks — the tree already forwards the subject unchanged, as `native-navigation-tree.test.tsx` pins

## 3. Verification and audits

- [ ] 3.1 Add the CHANGELOG `[Unreleased]` line; run root and web typecheck, `bun run lint`, and the focused web tests above
- [ ] 3.2 Build on the lead and check the menu visually over CDP (pane row, merged row, group row)
- [ ] 3.3 Run `bun scripts/check-fork.ts` and the private-facts guard; confirm no upstream-owned path changed and `FORK.toml` needs no entry
