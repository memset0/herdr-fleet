## Why

A Host row calls its machine unreachable whenever the lead's last receipt is older than the presented
tolerance, and on a pack that is most of every sweep. The lead's peer sweep relaxes to its idle
interval when its own event stream is healthy, while the phone polls far faster, so a member that is
answering every single request has its receipt age past `3 × pollMs` and back on every cycle. The row
flaps between "unreachable" and normal on a machine that is up.

Collie already states the rule this breaks, in bold, at the definition of the state itself: a stale
receipt is a statement about the RECEIPT, never about reachability, and a surface that spells it as
unreachable is wrong. Collie's own host chip records having made exactly this mistake and having
fixed it — a member answering every request was announced down beside a composer that was accepting
its writes. The Host row reintroduced it.

Upstream's own smoothing does not cover this case: the receipt clock is kept fresh by folding landed
proxied forwards into it, which happens for a member whose pane is being watched. A member that is
merely listed in the rails — which is every member, now that the rails present the whole pack — is
swept on the lead's idle cadence alone.

## What Changes

- Say "unreachable" only when the lead itself says the member is not writable, or when the protocol
  is incompatible. Those are claims about the machine.
- Present a stale receipt as what it is: the row keeps its ordinary glyph and says nothing, exactly
  as Collie's own chip does with the same state.
- Leave the roster, the tolerance, the sweep and every write gate untouched; this changes what a row
  says, not what anything believes.
- Move a member the lead is genuinely refusing below the ones that answer, and render it closed
  rather than spilling its last-good rows into the hierarchy — while keeping it openable, because
  those rows are content rather than an error.

Non-goals:

- Changing `hostHealth`, the tolerance formula, the lead's sweep cadence, or any write refusal.
- Presenting a last-seen time on the row, which would flap on the same clock for the same reason.
- Collie's own chip, banner and switcher, which already follow this rule.

## Capabilities

### Modified Capabilities

- `fleet-native-navigation-sidebars`: Narrow the Host row's unreachable wording to the lead's own
  refusal, and give a genuinely unanswering member its own place and default in the list.

## Impact

- Changes the fork-owned Host row reading and its focused test under `web/src/components/`.
- No data contract, no upstream file, and no new invasive path.
