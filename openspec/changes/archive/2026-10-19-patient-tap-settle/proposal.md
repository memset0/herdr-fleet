## Why

After the phone sends a key to a dialog or menu card (an option, an arrow, a tab), it waits for the pane to repaint before it revalidates, so the card shows the picture the key produced. Collie v1.22.6 bounds that wait at 1.2 s (`SETTLE_DEADLINE_MS`). A pane that redraws slowly (a long agent session, a pane reached through several remote shells) repaints after the wait gave up: the card keeps the old highlight until the next idle poll, and the next committing tap compares a stale picture with a fresh read and is refused.

## What Changes

- Lengthen the phone's post-key settle bound to several seconds, as a plain constant owned by the fork.
- Keep upstream's read spacing for the first reads, then keep reading at its last gap until the bound, so a repaint late in the longer window is still seen within that gap and the wait ends on the first changed read.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `fleet-send-patience`: adds the phone's post-key settle wait.

## Impact

Baseline Collie v1.22.6. Upstream-owned paths: `web/src/lib/harness/guard.ts` (the bound and the loop that spaces reads) and its test file. Fork-owned: `fleet/send-patience.ts` gains the constant. Only the web bundle changes, so this is a PATCH release (the lead alone redeploys).

Non-goals: no change to the settle baseline, the dialog guard's own retry, the ask answerer, the crew poll budget or the Send Protocol bounds. A key that changes nothing (an arrow at the end of a list) now holds its card for the longer bound before giving up; that cost is accepted.
