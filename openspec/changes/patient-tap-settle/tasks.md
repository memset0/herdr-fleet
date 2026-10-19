## 1. Settle wait

- [x] 1.1 Add `TAP_SETTLE_DEADLINE_MS` to `fleet/send-patience.ts`; make `SETTLE_DEADLINE_MS` in `web/src/lib/harness/guard.ts` take it and let `settleAfterSend` repeat the last delay until the deadline; restate the pinned cases in `guard.test.ts` and add a late-repaint case; verify `bunx vitest run src/lib/harness/guard.test.ts` passes.

## 2. Delivery

- [x] 2.1 Extend the `patient-send-protocol-port` entry in `FORK.toml` and add a CHANGELOG line; verify root and web typecheck, lint of touched files, `bun run test:fork`, the privacy guard and `openspec validate patient-tap-settle`.
