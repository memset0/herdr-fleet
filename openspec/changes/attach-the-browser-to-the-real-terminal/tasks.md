## 1. Assertions the design rests on

- [x] 1.00 Re-verify every statement under design.md's re-verification list against the post-merge tree, and correct design.md where the merge changed one, before starting any other task
- [x] 1.0 Probe the multiplexer's terminal-stream verbs and write the findings into the fork-owned `docs/herdr-fleet.md` rather than upstream's `HERDR_API.md`, which states what the bridge uses and would cost a second invasive path — frame format, whether cursor state is present, multi-observer semantics, behaviour when the Pane closes, and a version floor — because ADR 0008 records that none of it is verified and names this probe as the precondition for using them
- [x] 1.0a Record the ADR 0008 departure in `AGENTS.md` in its short normative form, naming the ADR and stating that the mirror is unchanged and that the terminal surface holds the Pane's geometry only while attached and hands it back on leaving; extend the `FORK.toml` entry that already claims `AGENTS.md` to cover it; do not edit any file under `.adr/`
- [x] 1.1 Assert same-origin `wss:` against the app's existing `connect-src 'self'` in a target browser, with a cross-origin negative control, and record the result in design.md; it is admitted, so no CSP directive was added and `bridge/server.ts` is untouched
- [ ] 1.2 Add the browser terminal renderer to `web/package.json`, pinned, and verify `cd web && bun install` then `bun run build` succeeds and the added bundle weight is recorded in design.md
- [ ] 1.3 Extend the `FORK.toml` manifest with the `web/src/router.tsx` entry and its reason, and verify `bun scripts/check-fork.ts` and `bun test scripts/check-fork.test.ts scripts/fork-manifest.test.ts` pass

## 2. The Gateway's terminal boundary

- [ ] 2.1 Add the upgrade route to the Gateway behind the existing session gate, refusing before the upgrade completes when the session, Host, or origin is wrong, and verify focused tests cover an accepted upgrade, a missing/expired/revoked session, a wrong Host, and a wrong origin
- [ ] 2.2 Close an established connection when its session expires or is revoked, and verify a focused test drives revocation mid-connection
- [ ] 2.3 Accept a Pane id with its Host and session scope and refuse any connection carrying a terminal id, command, argument, executable, socket path, or session selector, and verify a focused test asserts refusal rather than the value being ignored
- [ ] 2.4 Resolve a lead-local Pane to exactly one terminal, refusing an absent, ambiguous, or out-of-scope Pane with no fallback to a focused or neighbouring Pane, and verify focused tests cover each refusal
- [ ] 2.5 Implement the terminal server's framing as a client — the auth frame, input, resize, and the output/title/preferences replies — and verify a focused test drives the framing against a recorded fixture rather than a live server

## 3. Held sessions, single writer, replay

- [ ] 3.1 Hold a session for its configured grace period after the browser disconnects and close it with its terminal server and attachment when the period expires, and verify focused tests drive both with an injected clock
- [ ] 3.2 Re-establish a session transparently when the operator returns after it was closed, and verify a focused test asserts the surface behaves as on a first visit
- [ ] 3.3 Bound the number of sessions a device holds at once, closing the least recently used at the maximum, and verify a focused test asserts eviction closes the server and disturbs no other session
- [ ] 3.4 Refuse a second writable client to a terminal that already has one without displacing or exposing the established one, and verify a focused test asserts both properties
- [ ] 3.5 Deliver the bounded retained window before live output when a held session is reused, discarding oldest first and sending nothing to the terminal, and verify focused tests cover ordering, the bound, and a newly established session that has no retained window
- [ ] 3.6 Restrict an established connection to terminal input, rejecting every other message kind, and verify a focused test asserts rejection rather than forwarding
- [ ] 3.7 Forward a validated viewport geometry to the terminal, refusing an out-of-range value, and verify a focused test covers a resize taking effect and an out-of-range one being refused
- [ ] 3.8 Verify the terminal's dimensions return to their pre-connection value when the session ends by each of navigation, reload, network loss, and grace-period expiry

## 4. The browser surface

- [ ] 4.1 Add the global switch with its browser-local store, default off, and safe recovery from an absent or unreadable value, and verify focused tests cover default, round-trip, and unreadable storage
- [ ] 4.2 Add the fork-owned pane route element and loader wrappers and point `web/src/router.tsx` at them, and verify a focused test asserts that with the switch off the route renders Collie's own element and its loader is called unchanged
- [ ] 4.3 Verify the stub loader keeps `root.tsx`'s connection-bar dating on its snapshot branch, with a focused test that asserts `shownLastSeenAt` is unchanged while the switch is on and that `root.tsx` was not edited
- [ ] 4.4 Build the terminal surface: the renderer mounted inside the existing shell, the Pane's address unchanged, no mirror text requested, and a read-only establishment that says so where the device may not write; verify focused tests cover each
- [ ] 4.5 Retain terminal instances across Pane switches within a bound and verify a focused test asserts a return within the bound reuses the instance and beyond it disposes the oldest
- [ ] 4.6 Ignore any surface selection carried in an address or navigation state, and verify a focused test asserts the stored switch decides
- [ ] 4.7 Report the browser's viewport as the terminal's geometry on attach and on every later change, and make the current dimensions legible on the surface; verify focused tests cover attach, resize, rotation, and a type-size change
- [ ] 4.8 Copy a completed selection to the clipboard through `navigator.clipboard` on the user gesture, indicate the copy, and report a refused or unavailable clipboard while leaving the selection intact; verify focused tests cover success, refusal, and that no framed document is involved
- [ ] 4.8a Offer a discoverable modifier that suppresses mouse reporting for the gesture and selects locally, since the attached terminal enables mouse reporting and a plain drag is the program's input; verify focused tests cover a drag with and without it
- [ ] 4.9 Register the OSC 52 handler for clipboard writes within an explicit length bound and refuse clipboard reads, and verify focused tests cover a write within bounds, one over it, and a read request

## 5. The lead path, end to end

- [ ] 5.1 Exercise a lead Pane end to end against a real terminal server — open, type, copy a selection, resize the browser, leave, return within the grace period, return after it — and record that the return within the period performs no new attachment and that the Pane's dimensions returned to their pre-connection value after the last disconnect
- [ ] 5.2 Verify no terminal server, session, or upgrade route is exercised while the switch is off, and that the mirror surface's route, loader, polling, and rendering are unchanged

## 6. Configuration grammar

- [ ] 6.1 Add the optional peer `[terminal]` table and the optional per-member terminal endpoint on a lead's `[[reachability]]` entries, with loopback, distinctness, and bounds validation, and verify focused tests cover a complete table, a non-loopback bind, a collision with the Pack projection's lead-side endpoint, and out-of-range bounds
- [ ] 6.2 Verify a configuration omitting the terminal fields normalizes exactly as before, with a focused test asserting no default terminal endpoint is acquired
- [ ] 6.3 Verify a lead rejects `[terminal]` and every table still rejects unknown fields with a qualified diagnostic

## 7. The peer terminal service

- [ ] 7.1 Implement peer-local Pane resolution against the peer's own multiplexer server, requiring exactly one live match with no fallback, and verify focused tests cover the match, absent, ambiguous, and no-terminal cases
- [ ] 7.2 Implement the three-operation control contract with an exact message grammar, refusing unknown operations, unknown fields, out-of-range values, and any execution detail, and verify focused tests cover each refusal
- [ ] 7.3 Bind only the peer's declared loopback terminal endpoint and refuse a connection arriving otherwise, and verify a focused test asserts refusal before any Pane is resolved
- [ ] 7.4 Start one terminal server per resolved terminal with one writable client, after verifying the configured executable's identity, and verify focused tests cover a successful start, a missing executable, and a mismatched identity
- [ ] 7.5 Hold no terminal server at peer startup, link establishment, or configuration install, and verify a focused test asserts the idle process set
- [ ] 7.6 Stand the service down after its idle interval, removing its endpoint and ephemeral state, and bring it back with no residual state on the next request; verify focused tests drive both with an injected clock
- [ ] 7.7 Verify the service reads, derives, stores, and forwards no Pack membership, identity, certificate, secret, browser cookie, or signing material, with a focused test over its inputs and outputs

## 8. Reachability and lifecycle

- [ ] 8.1 Add the third, terminal-only projection to the link's argument set, published only when the peer's configuration declares a terminal endpoint, and verify the pinning test gains a three-projection case while its existing two-projection case stays byte-identical
- [ ] 8.2 Supervise the peer's terminal-service child with the peer's sanitized environment and no Fleet configuration path, session state, or browser material, and verify a focused test asserts the child's environment
- [ ] 8.3 Report an idle stand-down as idle rather than failed, recover an unexpected exit without restarting the Collie or link child, and verify focused tests cover both
- [ ] 8.4 Leave no orphaned terminal server, endpoint, or projection when the plugin stops or a start fails, and verify a focused test asserts cleanup

## 9. The peer path, end to end

- [ ] 9.1 Exercise a peer Pane end to end through the lead's Gateway — open, type, resize, leave, return — and record that the peer's terminal id never appeared on the lead outside the peer's own reply
- [ ] 9.2 Verify a peer that declares no terminal endpoint runs the same two children and publishes the same two projections as before this change
- [ ] 9.3 Verify the Pane, its terminal, the multiplexer server, Collie, and the link are unchanged after a full terminal lifecycle on a peer

## 10. Boundaries and the commit gate

- [ ] 10.1 Verify diagnostics across a full lifecycle and a failure at each layer contain no terminal content, retained output, cookie, token, signing material, injected identity header, or environment dump
- [ ] 10.2 Audit the tracked tree for private facts and verify `bun test scripts/check-private-facts.test.ts && bun scripts/check-private-facts.ts` passes with no device, host, domain, account, mesh, path, credential, or parent-tooling value introduced
- [ ] 10.3 Verify `FORK.toml` records every upstream path this change touched with its reason, and that `web/src/components/agent-chat.tsx` is not among them, via `bun scripts/check-fork.ts`
- [ ] 10.4 Add one line per change under `## [Unreleased]` in `CHANGELOG.md` in the same commit as each functional change, never touching the three version files, and verify the pre-commit guard passes
- [ ] 10.5 Assess the finished change against the release axis — whether a peer must redeploy — and say which axis it sits on rather than leaving the assessment for later
- [ ] 10.6 Run the full gate once when commit-ready: `bun test`, `cd web && bun run test`, both typechecks, `bun run lint`, `bun scripts/check-fork.ts`, `bash scripts/check-version.sh`, `bun run build`, `openspec validate attach-the-browser-to-the-real-terminal --strict`, `git diff --check`
- [ ] 10.7 Verify the planning artifacts describe what was actually implemented, and record the chosen session maximum, grace period, and retained-output bound in design.md
