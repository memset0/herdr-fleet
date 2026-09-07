## Context

See proposal.md — Why. The baseline's `TerminalSessions.acquire` has two publication gaps: it registers nothing while awaiting `startServer`, then registers a `Session` before awaiting `connect`. Concurrent callers can therefore either start duplicate servers or receive a session whose upstream is not bound. A connect rejection leaves the registered server behind. `closeAll` sees only registered sessions, and `TerminalConnection.establish` returns after a disconnected browser's pending acquisition without releasing any interest.

The current identity is already correct: `placementKey` distinguishes a local terminal from a peer's Host/Pane. Lead composition selects either `makeStartServer` or `makePeerStartServer`, while the peer entrypoint also uses `makeStartServer`. The shared `terminalServerArguments` currently appends the resolved terminal to a plain Herdr attach command. Neither identity nor routing needs replacement.

The archived `attach-the-browser-to-the-real-terminal/design.md` and ADR 0008 were read. The mirror and its grammar corpus remain untouched; the existing opt-in terminal surface already owns bounded geometry while its held attachment lives. The new accepted decision is narrower than browser takeover: an external Herdr attachment may be displaced, but another Fleet browser may not.

## Goals / Non-Goals

**Goals:** One owner of establishment, one fully connected session handed to all concurrent acquisitions, explicit release of each caller's temporary interest, and cleanup that remains correct at every await boundary. Enforce existing capacity before beginning work, not after a process already exists.

**Non-Goals:** No generic resource-pool framework, extra configuration, protocol, retry policy, new notice vocabulary, or change to retention/geometry limits. The independent `PeerTerminalService.attach` race under direct concurrent control requests is recorded separately and not repaired here. Its shared spawn policy is in scope; its separate lifecycle implementation is not.

## Decisions

### Publish one full-lifecycle flight per placement before the first await

Keep single-flight state inside `TerminalSessions`, keyed only by the existing `placementKey`. Publish the flight synchronously before invoking asynchronous startup. Its result becomes usable only after server creation and upstream binding both succeed. Do not publish a half-connected `Session`, and do not delete the flight when only server startup finishes.

On failure, clean up every acquired resource and remove the entry only if it is still the same generation. A subsequent request may retry; an earlier rejection, close callback, or completion must never delete or bind into its successor. Upstream output/closure arriving during connection must be handled by that same generation. Binding an upstream after the session was closed must close that upstream immediately and reject establishment, not resurrect the session.

Output received before the first browser attaches is retained and replayed too; a delayed connection
must not discard the repaint merely because this is the first attachment. The session also records
its last sent geometry, so a surviving shared caller can apply its own viewport without resending an
unchanged size. These are consequences of sharing the full establishment, not UI measurement changes.

Rejected alternatives: adding only a promise around `startServer` leaves the connect gap; using takeover to tolerate duplicate servers creates two owners that fight; keying by Pane alone merges different hosts.

### Acquisition interest and browser ownership are different

Use a small internal acquisition lease: each successful acquisition yields its session and an idempotent release for that caller's temporary interest. Count interest while callers await the shared flight. `TerminalConnection` releases that interest in a `finally` after it either attaches, observes that it has already closed, or receives `busy`. An attached client remains the single writer after the temporary lease is released.

Grace is armed only when no acquiring caller and no attached client needs the session. Reacquisition cancels grace; releasing a stale or refused caller cannot detach a different client, restart its timer, or stop its server. A browser that disconnects during startup cannot orphan a never-attached session: when acquisition settles its lease is released and the ordinary bounded grace applies. Failed acquisitions settle their interest without requiring callers to release a handle they never received.

This is not a public protocol. Migrate the one production caller and focused tests completely, with no compatibility alias. An abort framework or a global pool abstraction is unnecessary: late completion is already an explicit state to clean up.

### Capacity includes establishments; eviction never races a half-built entry

Count a slot before starting a terminal server and retain it through connection or failed-start cleanup. Shared callers consume one slot. Different keys can establish concurrently while slots are available. At capacity, close the least recently used established session under the existing eviction policy; acquiring interest prevents returning a session evicted between fulfillment and the caller attaching. If every slot is still establishing or temporarily acquired, wait for one of those transitions and reevaluate capacity rather than spawning over the bound, evicting a half-created resource, or inventing a new refusal.

No background retry loop or timer is needed for capacity: pending establishment/release transitions supply the wake-up. Waiting does not reserve an additional process slot. Preserve last-use ordering on reacquisition and detach, existing browser exclusivity, and the configured grace and output bounds. A failed start releases its slot so another placement is not permanently blocked.

### Shutdown invalidates first, then drains owned work

`closeAll` is the session manager's terminal shutdown boundary in production. Mark it closed before awaiting anything, refuse later acquisitions, invalidate pending results, close established sessions, and wait for in-flight establishment to settle and release resources. `TerminalService.stop` must await this drain before removing the owner-only socket directory. Repeated shutdown is idempotent.

A late `startServer` result is stopped without connecting it; a late `connect` result is closed and its server stopped. All waiting callers reject. Closure callbacks are generation-checked. Tests must cover both await boundaries, not only a fully started session. Keep the existing process adapter's scoped stop contract; do not turn this fix into process supervision or peer protocol redesign.

### Automatic external takeover is one fixed spawn policy

The shared Herdr attach argv is `herdr terminal attach <terminal-id> --takeover`. Real Herdr 0.8.2 smoke rejected the alternative flag-before-target form with `unknown option`; its help synopsis is not the accepted ordering. Both lead-local and peer-owned terminals receive the same invocation without a role-specific branch, request field, control, or setting. Preserve the owner-only UNIX endpoint, `-m 1`, `-o`, fixed command, trusted resolution, and absence of `--url-arg` and credentials.

The Gateway still admits only one browser writer. A concurrent second browser waits for the same completed session and receives `busy`; it does not cause another server or another Herdr attach. The unrelated manual-fit controller remains no-takeover.

Update only the short departure near the top of `AGENTS.md`; never edit `.adr/0008`. In `docs/herdr-fleet.md`, retain the measured plain-attach refusal as a historical probe, then state that the terminal surface now deliberately invokes takeover. Do not rewrite the old measurement into a claim that takeover was previously tested.

### Owned implementation and focused verification

Behavior stays in `fleet/terminal/{session,connection,service,spawn}.ts`. Existing tests there cover the changed contracts. `docs/herdr-fleet.md` and `openspec/**` are owned. `AGENTS.md` already belongs to the invasive `repository-guidance` entry; extend its rationale/verification for the takeover departure in the same change. `CHANGELOG.md` uses its existing classification. No new upstream business-logic port or font/UI edit is required.

The first regression delays startup, issues two acquisitions for the same key, and asserts exactly one start before releasing the barrier; it must fail against the unmodified implementation. A second barrier at upstream connection ensures no acquisition resolves early. Further focused cases cover shared rejection and retry, close during each phase, caller abandonment with another caller surviving, eventual grace with nobody surviving, and different-key capacity/LRU. Retain the existing second-writer denial tests and improve them with real concurrent establishment rather than duplicating their sequential coverage.

Run actual terminal smoke after implementation: an isolated Herdr namespace with only synthetic disposable Panes, real ttyd, and the product's actual session/spawn path. Hold an external attach, open through Fleet, prove displacement and continued terminal I/O, then prove a second Fleet browser is refused without another spawn. Exercise the peer path using a real loopback peer terminal service and the same disposable terminal; do not contact or deploy to a real peer. Observe grace expiry, shutdown, and removal of test-owned processes/endpoints. Keep runtime evidence outside tracked source and remove the throwaway harness after recording results.

## Risks / Trade-offs

- External takeover disconnects someone else's attach by design → explicitly accepted, documented, and limited to the requested resolved terminal; no browser-to-browser takeover.
- Shared acquisition makes ownership bugs less obvious → per-caller release, generation identity, and deterministic barriers at every await boundary.
- All capacity slots may be establishing → wait for an existing transition, preserve independent starts below the limit, and never silently exceed the bound.
- A dependency that never settles can delay shutdown → verify the real adapter's establishment behavior in the scoped smoke; do not add unrelated retry/timeout policy silently. If the adapter cannot drain under a demonstrated ordinary failure, report that prerequisite before claiming completion.
- The peer's separate direct-request race remains → explicitly outside this change; Gateway requests are single-flight, and peer takeover is still tested through the shared factory.
- Public source could accidentally carry operator facts → only synthetic public-safe fixtures/docs; audit task-owned changes and the fork boundary before publication.

## Migration Plan

No persisted state, wire shape, configuration, or dependencies change. After reviewed apply and focused proof, archive this generic product change and publish a functional commit through the coordinated index owner. A pushed code commit must be followed by the authorized lead-only exact-commit deployment; deployment mechanics stay outside the public repository. Do not deploy peers, allocate a release, or modify the version files in this iteration.

Release assessment: **minor**, because the shared spawn function is executed by peers as well as the lead. Current remote product tag is v3.3.0; a later release would normally be at least 3.4.0, but must reassess all then-landed Unreleased entries and the latest remote tag. This change deliberately stays Unreleased under the current development request. Product verification and archive can finish without claiming fleet-wide rollout; peer adoption awaits a separate released-tag rollout. Full-suite release gates are not triggered by this iteration.

## Verification record

The delayed-start regression failed on the original implementation with two starts instead of one.
After implementation, 108 focused terminal tests across seven files passed, including the local and
peer connection cases. Scoped strict TypeScript and oxlint checks passed. Real Herdr 0.8.2 / ttyd
1.7.7 smoke passed on both the local path and a real loopback peer terminal service: one startup,
external attachment displaced, second Fleet browser refused, newly executed terminal output received,
grace reuse and expiry, terminal-server exit, and the disposable Pane remaining alive. All temporary
runtime resources were owned by the smoke and removed afterward.

Strict change validation passed. The tracked-tree privacy guard passed while explicitly warning that
no local private-name inventory was available; new artifacts also received a manual public-content
review. The whole-tree fork check currently reports two paths outside this change: a concurrent UI
route edit awaiting its owner's manifest update and an existing untracked probe. Neither was changed
or claimed by this work; the integration owner must reconcile those findings before publication.
