## 1. Fork-owned fit core and Gateway route

- [x] 1.1 Add optional `scroll` to `fleet/terminal/resolve.ts`'s snapshot shape and a local fit core (`fleet/manual-pane-fit/local.ts`) that resolves exactly one Pane plus its rows and drives the retained controller; verify with `fleet/manual-pane-fit/local.test.ts`
- [x] 1.2 Teach the controller's conflict classifier Herdr's "already has an attached client" refusal and keep lease release on exit/stop; verify with `fleet/manual-pane-fit/controller.test.ts`
- [x] 1.3 Add the Gateway route module (`POST /fleet/api/pane/:id/resize`, `GET /fleet/api/pane-fit`) with strict query/body grammar, lead/member dispatch and one diagnostic line; mount it in `fleet/gateway.ts` behind the session and origin gates; wire controller lifetime in `fleet/gateway-main.ts`; verify with `fleet/manual-pane-fit/route.test.ts` and `fleet/gateway.test.ts`
- [x] 1.4 Remove the bridge-coupled `fleet/manual-pane-fit/action.ts`, its test and `capability.test.ts`; verify nothing imports them

## 2. Peer terminal service

- [x] 2.1 Add the `resize {pane, cols}` operation to `fleet/terminal/peer/protocol.ts` and the lead-side URL helper; verify with `fleet/terminal/peer/protocol.test.ts`
- [x] 2.2 Add `resize` to `PeerTerminalService` (held controller blocks stand-down, released on stop) and answer it in `peer/server.ts`; wire the controller in `peer-main.ts`; verify with `fleet/terminal/peer/service.test.ts`

## 3. Browser

- [x] 3.1 Add the fork-owned `useFleetPaneFit` hook (`web/src/components/fleet-pane-fit.tsx`) with availability read, Gateway request, busy flag and status reporting; verify with `web/src/components/fleet-pane-fit.test.tsx` (row placement, one request per tap, no request from render/layout, read-only disabled, member without endpoint disabled, no Gateway absent, Chat absent)
- [x] 3.2 Replace the inline resize logic in `web/src/components/agent-chat.tsx` with one hook call, feeding `afterTextSize` and the `fit-pane-width` command; teach the shared MSW handlers the 404; verify with `web/src/components/agent-chat.test.tsx` and `web/src/components/fleet-commands.test.tsx`

## 4. Upstream restoration and boundary

- [x] 4.1 Remove every resize-only hunk and restore files to v1.17.2 where nothing else remains (`bridge/index.ts`, `bridge/sessions.ts` and test, `bridge/mux/capabilities.ts`, `bridge/state-engine.ts` and test, `web/src/lib/api.ts`, `ack-manifest.ts`, `mux-capability.ts` and test); reduce `bridge/server.ts`, `bridge/crew/forward.ts` and test, `bridge/solo-baseline.test.ts`, `bridge/mux/herdr/adapter.ts`, `bridge/mux/types.ts`, `bridge/types.ts`, `web/src/lib/types.ts`, `CREW_PROTOCOL.md`; verify each with `git diff v1.17.2 -- <path>`
- [x] 4.2 Rewrite FORK.toml in the same commit: shrink `native-manual-pane-fit-port`, move surviving hunks to their owning entries, add the new owned web files; verify with `bun run test:fork` and record before/after counts
- [x] 4.3 Add one CHANGELOG line under `## [Unreleased]`; update `docs/herdr-fleet.md` for the moved route and probe result

## 5. Verification and release

- [x] 5.1 Run focused tests, both typechecks, lint, the build, `bun run test:fork` and the private-facts guard
- [x] 5.2 Push `main` unreleased and run the full suites on the remote test member against that exact commit, classifying every failure
- [x] 5.3 Cut the MINOR release, tag it annotated, push branch and tag by name
- [x] 5.4 Deploy the lead and every member except those excluded, verify versions, health in the crew census, an end-to-end fit of a throwaway lead Pane and a throwaway member Pane, and that Collie no longer answers the removed route (the member's fit core was verified on the member's own Herdr; the Gateway-to-member path is blocked by the pre-existing finding recorded in design.md)
