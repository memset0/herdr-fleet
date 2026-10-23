## 1. Owned module

- [x] 1.1 Add `fleet/send-failure-screens.ts`: the failure policy, the capture shape, and `SendFailureScreens` (owner-only folder, refusal of a symlinked folder, `O_EXCL|O_NOFOLLOW` temp write and rename, count/byte/screen bounds, one warning).
- [x] 1.2 Add `fleet/send-failure-screens.test.ts`: policy, retention by count and bytes, permissions, atomic write leaving no temp file, refusing a symlinked folder, server-generated names, errors swallowed; synthetic screens only.

## 2. Ports

- [x] 2.1 `bridge/surface/protocol.ts`: each read keeps `raw` and `step`; optional `failureScreens` dependency; `settle` hands the receipt and the distinct reads over after `count`, inside a try.
- [x] 2.2 `bridge/index.ts`: wire `SendFailureScreens` on `<stateDir>/send-failures`.
- [x] 2.3 Fleet's protocol cases under the `fleet-send-failure-screens` marker: the sink is called with raw screens on a `probe_failed` and a `draft_present`, never on a `sent`, and a throwing sink leaves the answer unchanged.

## 3. Delivery

- [x] 3.1 `FORK.toml`: extend `patient-send-protocol-port`, add the `index.ts` port entry, add the owned test to `fleet-runtime`'s verify list; CHANGELOG line under Unreleased → Added.
- [x] 3.2 Verify: focused `bun test`, both typechecks, `bun run lint`, `bun scripts/check-fork.ts`, `bun scripts/check-private-facts.ts`, `openspec validate fleet-send-failure-screens --strict`.
- [ ] 3.3 Observe on the lead after deploy: a failed send leaves one record under `send-failures/` with its screens, and the folder stays within its bounds.
