## 1. The route

- [x] 1.1 Add `resize` to the pack's forwardable pane grammar; verify `packRouteFor` answers for it and that its kind is a write
- [x] 1.2 Map the forwarded audit action for `resize` to `pane.resize`, and correct `focus` to `pane.focus`, so each matches what the peer's own handler writes; verify both against the handlers
- [x] 1.3 Add the row to `PACK_PROTOCOL.md` §5 as additive-optional under §7.1, without bumping the protocol version

## 2. The guard that missed it

- [x] 2.1 Make the drift test read every pane-route declaration in `server.ts` rather than `PANE_ROUTE` by name, handling both an alternation and a plain trailing segment; verify it derives `resize` and fails on a route that is declared locally and not federated
- [x] 2.2 Add a fork-owned check that the resize route is federated, so the feature's own suite says so too

## 3. Verification

- [x] 3.1 Run both typechecks, the linter, the fork check and the pack-wire check, and the full suites on nvl72 against the pushed commit
- [x] 3.2 Record the three upstream paths on the existing manual-pane-fit manifest entry
- [x] 3.3 Add the `CHANGELOG.md` line, and assess the release axis — this obliges every member to redeploy
