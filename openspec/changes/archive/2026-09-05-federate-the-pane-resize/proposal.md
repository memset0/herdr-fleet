## Why

Resizing a Pane that lives on another pack member does nothing. The lead answers `501
route_not_federated`, the browser cannot tell that apart from any other failure, and the operator
sees "the pane could not be resized" with no hint that the reason is the machine it is on.

`/api/pane/:id/resize` was added to `bridge/server.ts` as its OWN route literal, beside the
`PANE_ROUTE` literal that carries every other pane action. The pack's forwardable allowlist mirrors
`PANE_ROUTE`, and there is a test whose whole job is to keep the two from drifting — it reads
`PANE_ROUTE` out of `server.ts` and asserts every action in it is forwardable. A second literal is
invisible to it. The guard that existed for exactly this was walked around by declaring the route
somewhere it does not look.

## What Changes

- `POST /pack/v1/pane/:id/resize` joins the federated surface, additive-optional under §7.1 exactly
  as `focus` did: a lead that predates it never calls it, and a peer that predates it answers 404.
- The drift guard reads EVERY pane-route literal `server.ts` declares, not one of them, and derives
  the action set from all of them. A third literal fails the test rather than slipping past it.
- The forwarded audit action for `resize` is `pane.resize`, which is what the peer's own handler
  writes, so the two independent logs still read against each other. **`focus` is corrected the same
  way** — the peer writes `pane.focus` and the lead was recording bare `focus`; it is the same defect
  in the same table, found while fixing this one.

Non-goals, and one of them is a known gap left open deliberately:

- **The capability is still read from the lead.** `useMuxCapability("resizePane")` reads the lead's
  `/api/config`, so on a mixed pack the button's visibility on a peer's Pane is decided by the wrong
  machine. `/pack/v1/config` is consumed by the lead and deliberately not proxied, so closing this
  needs a decision about how a per-host capability reaches the browser — a bigger question than this
  bug, and not one to answer inside it. It is inert on this fleet, where every member runs Herdr.
- No change to how columns are measured, to what the resize does, or to rows staying server-owned.

## Capabilities

### Modified Capabilities

- `fleet-manual-pane-fit`: a resize reaches the machine the Pane is on, like every other Pane write.

## Impact

- Upstream-owned: `bridge/pack/forward.ts` (one action in the allowlist, two audit mappings),
  `bridge/pack/forward.test.ts` (the drift guard), `PACK_PROTOCOL.md` (§5's route table). All three
  recorded on the existing `native-manual-pane-fit-port` entry, which already owns this feature's
  other upstream paths.
- Fork-owned: `fleet/manual-pane-fit/capability.test.ts`.
- Wire: additive-optional under §7.1, so `PACK_PROTOCOL_VERSION` does not move. A peer that has not
  been levelled answers 404 and the operator sees the same refusal they see today.
- **Every member must be redeployed** before a resize works across the link: the peer answers the new
  route only once it is running this code.
