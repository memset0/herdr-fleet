## Why

A Pane's terminal that another browser holds shows "busy" with no way to claim it short of closing
the other browser. The owner wants an explicit Take over on that notice, replacing the rule that a
second browser can never displace the first.

## What Changes

Baseline: Collie v1.23.3 as recorded in `UPSTREAM.md`; Fleet 3.23.2.

- The terminal connection accepts one new, optional parameter, `takeover=1`, the operator's explicit
  intent. With it, the Gateway detaches the attached browser with a new closed notice `taken` and
  attaches the new one to the SAME session and upstream; nothing is restarted or started twice. It
  logs `terminal.session-taken {pane}`. Without it, a second browser is still refused as `busy`.
- The surface's busy notice offers Take over beside Reconnect; a displaced surface says the terminal
  was taken over and offers Reconnect (which then sees busy and can take it back).
- `AGENTS.md`'s ADR 0008 departure states the new rule: shared establishment, refusal by default,
  displacement only by explicit operator take-over, never automatic, never a duplicate-start fix.

Non-goals: no automatic take-over; no change to Herdr's own `--takeover` of external attachments,
to the peer terminal service or its grammar, or to the browser↔Gateway frame grammar.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-pane-terminal`: connection address, browser exclusivity, external-takeover wording, and the busy notice's Take over.

## Impact

Fork-owned only: `fleet/terminal/{admit,session,connection,service}.ts`, `fleet/gateway.ts`,
`fleet/server.ts`, `fleet/ui/terminal/link.ts`, `web/src/components/fleet-terminal.tsx`, their tests,
the Fleet locale files, and `AGENTS.md`. Gateway and frontend only, so a PATCH.
