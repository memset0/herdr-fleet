## 1. Model and preferences

- [x] 1.1 Give `fleet/ui/native-navigation/model.ts` a Host row with a collapse-marker disclosure identity and a flag saying the marker means concealed, and keep the Host out of a selection's ancestors.
- [x] 1.2 Carry the operator's own Pane name into `NavigationPaneInput` and name an elided row by it, then by the Tab it replaced, never by a display label the terminal or Agent supplied.
- [x] 1.3 Update `fleet/ui/native-navigation/model.test.ts` for the Host row, the collapse marker, both elided-row naming cases, and the unchanged naming of Panes inside a surviving Tab.

## 2. Tree and rails

- [x] 2.1 Render the Host as an ordinary row with the shared disclosure control and inverted marker semantics, and disclose or conceal its Spaces through the existing animation.
- [x] 2.2 Activate a row with children by disclosing it; keep the Space route for a Space row with no children.
- [x] 2.3 Reduce the indentation step and drop the rule under each rail's title.
- [x] 2.4 Update `web/src/components/native-navigation-tree.test.tsx` and `native-navigation-shell.test.tsx` for the Host row, the disclose-on-activate rule, and the elided-row name.

## 3. Verify and publish

- [x] 3.1 Run the focused owned and component tests plus both typechecks, lint, the fork check and strict OpenSpec validation.
- [x] 3.2 Add one `CHANGELOG.md` line under `Unreleased`, commit only this change's paths, push, archive, and redeploy the exact pushed commit to v3 staging.
