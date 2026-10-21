## 1. No hold

- [x] 1.1 Add `fleet/send-holds.ts`; gate `holdsEnd` and the join check on it; turn it on for Collie's cases and add Fleet's cases and `fleet/send-holds.test.ts`; verify the bridge suite passes.

## 2. Delivery

- [x] 2.1 Extend `patient-send-protocol-port` in `FORK.toml`, add a CHANGELOG line; verify typecheck, lint, `bun run test:fork`, the privacy guard and `openspec validate no-send-hold`.
