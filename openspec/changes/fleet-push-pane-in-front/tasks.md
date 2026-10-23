## 1. Implementation

- [x] 1.1 Add `paneInFront(clients, targetUrl)` in `web/src/lib/fleet-push-focus.ts`; verify with `fleet-push-focus.test.ts` (focused same pane withholds; unfocused, other pane, other host, non-pane target and other origin show)
- [x] 1.2 Make the service worker's check call it with the tap's own target URL; verify with web typecheck (worker config) and the existing `sw-routes`/`push-decision` tests
- [x] 1.3 Extend the existing `authenticated-navigation-cache` entry for `web/src/sw.ts` in `FORK.toml`, and own the new helper files; verify with `bun scripts/check-fork.ts`

## 2. Verification

- [x] 2.1 CHANGELOG line, `bun run lint`, both typechecks
- [ ] 2.2 After the lead deploy, on the owner's desktop: a pane notification appears while the app window is open but unfocused, and a tap opens that pane
