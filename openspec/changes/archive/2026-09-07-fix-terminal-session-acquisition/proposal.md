## Why

Concurrent browser connections can make `TerminalSessions.acquire` start two terminal servers for the same placement before either startup completes; this is a reported defect, not a hypothesis. Separately, an existing external Herdr attachment currently prevents the requested terminal surface from opening, and the operator has explicitly chosen automatic takeover of that attachment.

## What Changes

- Make acquisition single-flight by `placementKey` across the complete server-start and upstream-connect lifecycle, including failure, caller release, grace expiry, LRU capacity, and shutdown.
- Keep one Fleet browser client per held session: concurrent callers share establishment, but a second browser writer still receives `busy` without displacing or observing the first.
- Always use `herdr terminal attach --takeover` for terminal servers started on either the lead or a peer. This intentionally disconnects an external attachment; it is not a substitute for preventing duplicate Fleet startups.
- Update the working agreement's short ADR 0008 departure and current terminal guidance, keeping historical probe results distinct from the new policy and leaving upstream ADRs untouched.
- Add focused deterministic regressions for the reported race and relevant lifecycle boundaries; prove actual takeover using disposable terminals, never an existing operator Pane.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-pane-terminal`: Complete single-flight acquisition and cleanup, bounded concurrent establishment, and explicit separation between external Herdr takeover and Fleet browser exclusivity.
- `fleet-peer-terminal-service`: The peer's fixed, locally resolved attach command takes over an external attachment under the same policy as the lead.

## Impact

The exact upstream baseline remains Collie v1.5.2, tag object `38798351a64cae43c03f156c0b80f22f14d50565`, commit `cea2035e1f02d560d1bac66c85314828a7e01c20`. This changes fork-owned terminal behavior; unchanged Collie routing, authentication, mirror rendering, grammars, and manual Pane fitting are reused without modification.

Primary paths are `fleet/terminal/session.ts`, `connection.ts`, `service.ts`, `spawn.ts`, their focused tests, `docs/herdr-fleet.md`, `AGENTS.md`, `FORK.toml`, and `CHANGELOG.md`. Peer startup already uses the same `makeStartServer` and argument builder; its fixed request grammar and trust boundaries do not change. No dependency, browser message, Pack wire, or configuration change is required.

Non-goals: fonts, new controls or settings, browser-to-browser takeover, manual-fit controller takeover, mirror changes, upstream test-runtime repairs, unrelated temporary-file cleanup, peer provisioning or deployment, upstream synchronization, and retirement of any previous generation. Independent peer control-service acquisition changes are outside this proposal unless separately included during review.

The change reaches code peers execute and therefore has the **minor** release axis. This iteration remains a functional change under **Unreleased**, with no version bump, tag, or release cut; lead-only development deployment does not claim that peers have adopted the change. Planning stops for review before apply.
