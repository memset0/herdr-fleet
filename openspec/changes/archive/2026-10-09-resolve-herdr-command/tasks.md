## 1. Shared resolver

- [x] 1.1 Add `fleet/herdr-command.ts` resolving `HERDR_BIN_PATH` (absolute, executable regular file), then `PATH`, else a diagnostic naming both; verify with `fleet/herdr-command.test.ts`

## 2. Call sites

- [x] 2.1 Use the resolver in `fleet/terminal/peer-main.ts` for attach and fit, failing start with its diagnostic
- [x] 2.2 Use it in `fleet/gateway-main.ts` for the lead's terminal attach and Pane fit; take the attach command as an input in `fleet/terminal/service.ts` / `fleet/terminal/spawn.ts`; verify with `fleet/terminal/spawn.test.ts` and `fleet/terminal/service.test.ts`
- [x] 2.3 Use it for `ManualPaneFitControllerManager`'s default binary; verify with `fleet/manual-pane-fit/controller.test.ts`
- [x] 2.4 Add the new test to `FORK.toml`'s `fleet-runtime` verify list and one CHANGELOG line under `## [Unreleased]`

## 3. Verification and release

- [x] 3.1 Run focused tests, both typechecks, lint, the build, `bun run test:fork` and the private-facts guard
- [x] 3.2 Push `main` unreleased and run the full suites on the remote test member against that exact commit, classifying every failure
- [x] 3.3 Cut the MINOR release, tag it annotated, push branch and tag by name
- [x] 3.4 Deploy the lead and every member except those excluded; verify versions and health in the crew census, the member's terminal service running, an end-to-end fit of a throwaway member Pane keeping rows, and the member terminal route through the Gateway
