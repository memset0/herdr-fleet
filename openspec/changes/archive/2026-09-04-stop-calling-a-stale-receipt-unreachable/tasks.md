## 1. Narrow the wording

- [x] 1.1 Make the Host row say "unreachable" only for the lead's own refusal or an incompatible protocol, and present a stale receipt with the ordinary glyph and no word.
- [x] 1.2 Pin all three readings in the focused tree test: refused, stale-but-reachable, and no roster.

## 2. Place an unanswering member

- [x] 2.1 Sort a member the lead is refusing after the ones that answer, keeping the lead first and the roster's order otherwise, and render it closed by default while leaving it openable.
- [x] 2.2 Pin the order, the closed default, the operator's open, and that a merely-stale member is neither moved nor closed.

## 3. Verify and publish

- [x] 3.1 Run the focused tree and rail tests, both typechecks, lint over the changed files, fork and strict OpenSpec validation.
- [ ] 3.2 Run the full root and Web suites once, add one `CHANGELOG.md` line, commit only this change's paths, push, deploy, then sync, archive, push and redeploy the archive HEAD.
