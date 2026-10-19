## Why

On Collie v1.22.6 the Send Protocol gives each step a sub-second to three-second window, and its poll gap doubles. A pane that redraws slowly (a long agent session, a pane reached through several remote shells) draws the probe character after the probe step has given up; the cleanup only runs when the failing read already shows it, so the late character stays in the box, every later send is refused `draft_present`, and an Add-to-it send ships the probe character as part of the message.

## What Changes

- After a probe whose character never showed, keep watching for one more probe bound. A character that then lands where S0's box was — the box holds S0's text plus exactly the probe character, and nothing else at the box changed — gets one Backspace through the key gate, and its removal is read back by polling rather than by one read. Any other screen gets no key. Never Escape.
- At S0 of a send, command or Add-to-it, a found box that holds nothing but the probe character is treated as Collie's own debris, not a person's draft: one Backspace through the gate, the box read back empty, then S0 is read again and the send continues. A box with anything else in it keeps upstream's `draft_present` refusal.
- Lengthen every Send Protocol step bound (S0, probe, S1, S2, the notice wait) and therefore the per-pane lock bound, as plain constants.
- Cap the poll gap so a long window still notices a passing read within a fraction of a second; the bounds only cost time when a step fails.
- Give the phone's `POST /api/send` (and the reply route a crew pane's send takes) a client budget above the new lock bound, and give the lead's forward of a member's reply route a budget above it too, so neither gives up before the bridge answers.

## Capabilities

### New Capabilities
- `fleet-send-patience`: Send Protocol timing for slow panes, the cleanup of a probe character that lands late, and the budgets of the callers that wait on a send.

### Modified Capabilities
None.

## Impact

Baseline Collie v1.22.6. Upstream-owned paths: `bridge/surface/protocol.ts` (bounds, gap cap, late-probe cleanup, debris sweep) and its test file; `web/src/lib/api.ts` (one timeout on the send request); `bridge/crew/forward.ts` and its test (one budget on the reply route). Fork-owned: `fleet/send-patience.ts` with its test. Bridge code that members run changes, so this is a MINOR release. The cleanup half is generic and offered upstream separately; the timing half stays fork-only.

Non-goals: no change to the probe's pass rules, the outcome list, the receipt shape, the crew wire, the hold queue, the ask answerer or the Surface fold; no retry of a failed probe; no relaxation of the never-Escape and keys-only-through-the-gate rules.
