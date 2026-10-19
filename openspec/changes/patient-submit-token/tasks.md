## 1. Token lifetime

- [x] 1.1 Add `KEY_TOKEN_LIFETIME_MS` to `fleet/send-patience.ts`; make `TOKEN_LIFETIME_MS` in `bridge/surface/key-gate.ts` take it; restate the 151 ms protocol case through `TOKEN_LIFETIME_MS`; add a send-patience case; verify the key-gate, protocol, ask and send-patience tests pass.

## 2. Delivery

- [x] 2.1 Extend the `patient-send-protocol-port` entry in `FORK.toml` and add a CHANGELOG line; verify root typecheck, lint of touched files, `bun run test:fork`, the privacy guard and `openspec validate patient-submit-token`.
