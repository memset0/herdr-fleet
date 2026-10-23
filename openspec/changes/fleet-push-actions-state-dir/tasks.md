## 1. Implementation

- [x] 1.1 Add a `push-keys|push-test` branch to `scripts/herdr-fleet.sh` that requires an absolute `HERDR_PLUGIN_STATE_DIR`, exports `COLLIE_STATE_DIR="$HERDR_PLUGIN_STATE_DIR/collie"` and execs the Collie shim with the same verb; verify with a lifecycle test that runs the launcher against a stub shim and sees that state directory
- [x] 1.2 Point both manifest actions at `scripts/herdr-fleet.sh`; update the manifest validator and the launcher-count assertion in `fleet/lifecycle.test.ts`; verify with `bun test fleet/lifecycle.test.ts`

## 2. Verification

- [x] 2.1 Add the CHANGELOG line; run `bun run typecheck`, `bun run lint` and `bun scripts/check-fork.ts`
- [ ] 2.2 After the lead deploy, invoke `herdr plugin action invoke push-test --plugin memset0.herdr-fleet` and confirm it reports delivery to the subscribed device
