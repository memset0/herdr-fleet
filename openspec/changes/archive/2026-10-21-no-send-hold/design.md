## Decisions

- **A switch in an owned module, read at the two places a send enters the queue.** `holdsEnd` (a refusal becomes a hold) and the join check in `send` (a new send queues behind held ones) both read `sendHolds.enabled` from `fleet/send-holds.ts`, false in Fleet. Wiring no `HoldStore` into the protocol in `bridge/index.ts` was rejected: requests held before the switch would then never drain, and `index.ts` would become a new invasive path.
- **Release, cancel and replay stay.** The store, the release poll and the cancel route still run, so anything held before the upgrade is sent or expires as Collie designed.
- **Tests:** the switch is a mutable object so Collie's own hold cases keep running unchanged; the protocol test file's top-level `beforeEach` turns it on, Fleet's describe turns it off, and `fleet/send-holds.test.ts` reads the source to pin the shipped value.
