## 1. Send Protocol

- [x] 1.1 Raise the step bounds and cap the poll gap in `bridge/surface/protocol.ts`; restate upstream tests that pinned old numbers through the exported bounds; verify `bun test bridge/surface/protocol.test.ts` passes.
- [x] 1.2 Add the late-probe watch, the polled removal check and the S0 debris sweep; add focused cases (late character removed, other text not touched, nothing arriving, lone character swept before a send and an Add-to-it, draft with a probe character still refused, fast probe ends on its first read); verify the protocol suite and `no-harness-names.test.ts` pass.

## 2. Callers

- [x] 2.1 Add `fleet/send-patience.ts` with its test asserting phone budget > forward budget > lock bound; wire the phone's send timeout in `web/src/lib/api.ts` and the reply-route forward budget in `bridge/crew/forward.ts`; verify `bun test fleet/send-patience.test.ts bridge/crew/forward.test.ts` passes.

## 3. Delivery

- [x] 3.1 Record the ports in `FORK.toml` and a CHANGELOG line; verify root and web typecheck, lint of touched files, `bun run test:fork`, the privacy guard and `openspec validate patient-send-probe`.
