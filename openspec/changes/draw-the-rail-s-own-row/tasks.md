## 1. The shared naming rule

- [x] 1.1 Lift the operator-chosen-name rule out of the navigation model into `fleet/ui/pane-naming.ts` and have both surfaces import it.

## 2. The rail's row

- [x] 2.1 Add the fork-owned row: the Agent's mark with the state and the shortcut ordinal badged at its corners, where-then-what on two lines, the age at line one's trailing end, and the favourite toggle as a sibling control.
- [x] 2.2 Rewrite the rail over Collie's own triage and section headings, applying favourite-first ordering inside each section and numbering the ordinal across the whole rail.
- [x] 2.3 Cover the order, the two lines, the numbered-Pane name, the ordinal limit, and the unknown-versus-empty herd.

## 3. The hierarchy's indentation

- [x] 3.1 Put the guide line on the centre of the control that opened the level, begin children one control-width in, and draw no disclosure column on a row with no children.

## 4. Verify and publish

- [x] 4.1 Run the owned, rail, tree, shell and Agent-list tests plus both typechecks, lint, the fork check and strict OpenSpec validation.
- [x] 4.2 Record the new fork-owned roots in `FORK.toml`, add a `CHANGELOG.md` line, commit, push, archive, and redeploy.
