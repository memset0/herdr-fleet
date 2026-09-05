## Context

See proposal.md — Why. The constraints below are the ones that were measured or read out of the tree,
and every decision after them follows from one of them.

**The terminal server forks per connection.** Measured against `ttyd 1.7.7-40e79c7`: no child while
idle, one child per WebSocket client, each child exits with its own client, and the server itself
survives. Its command — including the terminal id — is fixed when it starts, so one server serves one
terminal. `--url-arg` would let the connecting side supply arguments and is the only way one server
could serve many terminals; it stays off.

**Attaching is fast, and the multiplexer repaints on attach.** Measured against a live server, timing
a read-only attach from process start to first byte: a bare shell Pane at 38 / 109 / 166 ms
(min / median / max over six runs), an agent Pane at 93 / 227 / 1891 ms over five. Each attach
delivered the whole current screen immediately — 7.2 KB and 12.6 KB respectively — so the far end
already provides, for free, the repaint a reconnecting client needs. The single 1.9 s sample is the
tail worth remembering; the median is not a number that justifies a cache.

**This product has no WebSocket anywhere.** The Gateway proxies with `fetch`, and Collie has no
WebSocket in `bridge/`, `web/`, or the Pack layer — re-confirmed against Collie 1.5.1, where a
repository-wide search still returns nothing. There is no existing upgrade path, connection registry,
or backpressure convention to follow. One detail decides where the route goes: `fleet/proxy.ts` lists
`upgrade` among the hop-by-hop headers it strips, so the terminal route must be answered *before*
`proxyCollie` rather than through it.

**A peer's terminal id does not exist on the lead.** `bridge/mux/herdr/adapter.ts` drops
`WirePane.terminal_id` when it builds `MuxPane`, and Pack forwards the post-adapter model — the field
appears in `bridge/pack/` only in the `fake-herdr.ts` stub. Pack is also HTTP request forwarding
(`/api/pane/<id>?host=<peer>`), not a stream channel.

**The peer's link carries exactly two projections and is pinned by a test.**
`fleet/pack-reachability.ts` states each SSH option as a security property; the projection list is
part of that argument set.

**One upstream file is unclaimed.** `web/src/router.tsx` appears in no `FORK.toml` entry.
`web/src/components/agent-chat.tsx` does — it carries five ports under `native-manual-pane-fit-port`,
and the manifest allows one entry per path.

## Goals / Non-Goals

**Goals:**

- Put the terminal on the Pane's own address, inside the existing shell, with no second router, no
  framed document, and no second authentication.
- Keep the mirror surface byte-identical when the switch is off — including its route, its loader and
  its polling.
- Make the flip-back gesture free, without building a cache the measured attach cost cannot justify.
- Add the terminal without teaching `agent-chat.tsx` that terminals exist.

**Non-Goals:**

- A general WebSocket framework. This change adds one upgrade path with one message grammar, not a
  transport layer for future features.
- Making the terminal surface work below the shell's wide breakpoint. The rails already stand down
  there; the terminal follows whatever the shell does and adds no responsive behavior of its own.
- Sharing one held session between two browsers, or reading a terminal without being able to write it.

## Decisions

### The pane route's element and loader are chosen downstream, not branched inside the pane page

`web/src/router.tsx`'s pane route swaps `element` and `loader` for fork-owned wrappers. With the
switch off each delegates to Collie's `DetailRoute` and `paneLoader` unchanged; with it on, the
element renders the terminal surface and the loader returns a stub without fetching.

*Alternatives considered.* **A branch inside `agent-chat.tsx`** — a hook plus one `??` at the seam
between the mirror and the bottom region. It is a small edit and it was the first recommendation, but
it lands on the one file already carrying five ports, and with the switch on it still mounts the whole
mirror machinery — pane text fetched, ANSI parsed, status lines derived, drafts and find state built —
to render none of it. **A new sibling route** at `/pane/:paneId/terminal`. Zero edits to
`agent-chat.tsx`, but the header, the banners and the strips band all live inside it, so the route
would copy roughly 350 lines of upstream JSX that no manifest entry tracks and no upstream sync would
reach. The wrapper avoids both: nothing is copied, nothing extra is mounted, and the URL, the rails,
the header and every existing link are untouched because the route is the same route.

`web/src/routes/root.tsx` reads this route's data through `useRouteLoaderData(PANE_ROUTE_ID)` to date
the connection bar. The stub therefore reports no error, which sends that function down its existing
"use the snapshot's stamp" branch; `root.tsx` is not edited and a test pins the behaviour.

### The Gateway is the terminal server's client, and outlives the browser

The browser upgrades against the Gateway; the Gateway holds its own connection to the terminal server
and keeps it when the browser goes away. This is forced by the fork-per-connection measurement: a
browser connected directly — in a frame or otherwise — re-runs the attach on every Pane switch, and no
amount of client-side caching can undo that.

It also means the terminal surface cannot be an iframe of the terminal server's own page, which
removes the CSP question that approach would have raised.

**Same-origin WebSocket is admitted by the existing `connect-src 'self'` — measured, not assumed, so
the CSP does not change.** A page served with this app's exact CSP header opened a same-origin
`ws://` connection with no `securitypolicyviolation` and a completed handshake. The negative control
that makes that result mean something: the same page, same CSP, attempting a WebSocket to another
port was refused with `connect-src | blocked=ws://…`. So the directive is doing its job and simply
does not stand in the way of the terminal's own origin.

### How far this departs from ADR 0008, and how far it does not

ADR 0008 — *Collie does not run a terminal emulator* — is the settled answer to "render the pane
properly", and it names this change's two verbs directly: *"don't reach for `terminal session
observe`/`control`"*. Per the fork's working agreement an upstream ADR is never edited into agreement
with us, so the departure is recorded here and in the short normative form in `AGENTS.md`.

**What is not departed from.** ADR 0008 is about the *mirror*: that Collie's pane rendering re-uses
Herdr's already-rendered grid rather than re-emulating it, that the grammars consume `StyledLine[]`,
and that the 34-capture fixture corpus stays coupled to `pane.read`. None of that changes. The mirror
keeps its route, its loader, its parser, its grammars and its corpus, byte for byte, and it is what
renders whenever the switch is off — which is its default. This change adds a second surface beside
the mirror; it does not make the mirror an emulator, and a terminal emulator on the *terminal* surface
is not the thing that ADR rejected.

**What is departed from.** The ADR's blanket refusal of `observe`/`control`, on two grounds it states:

- *"`control` … resizes the shared PTY … Collie fights the person at the keyboard."* Departed from,
  and the measurement is why. The ADR reasons about `control`; the verb this design uses is `attach`,
  and `attach` behaves differently in the one way that matters. Measured: `attach` takes its geometry
  from its own terminal, follows a later `SIGWINCH` live (40 → 25 → 50 rows, each with a repaint),
  and **returns the Pane to its previous dimensions when it exits** (back to 42). `control` does not:
  it applies `--cols/--rows` once, ignores a later `SIGWINCH`, and leaves the Pane at the size it set.
  So the fight the ADR describes is real for `control` and bounded for `attach` — the browser holds
  the geometry only while it is attached, and hands it back by leaving. A terminal drawn at a foreign
  size on a phone is the whole problem the terminal surface exists to solve, so it takes the geometry;
  the requirement pairs that with the automatic return, and neither half is optional.
- *"`HERDR_API.md` verifies nothing about `observe`/`control`: not the frame format, not multi-observer
  semantics, not a version floor."* True when written and still true. That is a gap to close, not a
  reason to stop: ADR 0008's own "what would justify revisiting" names a probe as Phase 0, and this
  change ran it before writing any code. It is recorded in `docs/herdr-fleet.md`, not in
  `HERDR_API.md` as the ADR suggests, for two reasons that point the same way: that document states
  what *the bridge* uses and none of these verbs are used by the bridge, and it is upstream-owned, so
  writing there would spend a second invasive path on knowledge only the fork has. `docs/herdr-fleet.md`
  is fork-owned, which keeps this change at one invasive path as designed.

  What the probe settled, beyond the framing already stated in Context: cursor state **is** carried by
  `attach` — the ADR's own open question, answered — along with the terminal's real mode state; a
  second `attach` is refused by Herdr with exit 1 while the first keeps streaming, so single-writer
  needs no implementation above this layer; and a closing Pane ends the attachment with a plain
  sentence *in the byte stream*, so the Gateway must detect the child's exit rather than read that
  text.

**Why the ADR's strongest argument does not reach here.** Its case is that an emulator in the bridge
would re-emulate an already-emulated screen — a second renderer disagreeing with the first, whose cost
lands on the fixture corpus. A separate opt-in surface has no second renderer in that sense: there is
one renderer, in the browser, on a byte stream that never becomes a `StyledLine`, never meets a
grammar, and never touches a capture. The disagreement the ADR is protecting against cannot occur
between two surfaces that share no code path.

### The clipboard is a reason to own the surface, not a detail of it

The previous generation's terminal could not copy, and the cause is three separate things, each of
which the fork-owned surface fixes by construction. Read out of that build's bundled frontend and its
landing page:

- it attempts select-to-copy through `document.execCommand("copy")` from an `onSelectionChange`
  handler — a deprecated interface, called outside a user gesture, which browsers refuse;
- it renders inside an `<iframe>` carrying no clipboard permission, so a clipboard write from within
  it has none;
- it registers OSC handlers `0, 1, 2, 4, 8, 10, 11, 12, 104, 110, 111, 112, 1337` and **not** `52`, so
  a program in the terminal cannot ask for a copy either.

Owning the surface makes all three ordinary: the write happens on the pointer gesture that completed
the selection, through `navigator.clipboard`, in the application's own document — and the Gateway's
`permissions-policy` names only camera, microphone and geolocation, so nothing restricts it. OSC 52 is
registered for writes and refused for reads, because a program that can *read* the operator's
clipboard is a different thing from one that can offer to fill it.

The probe added a fourth obstacle the previous generation never got far enough to hit: the attached
terminal turns mouse reporting **on** (`?1000h`, `?1002h`, `?1003h`, `?1015h`, `?1006h` are in the
first frame). While a program is consuming mouse events, a drag is that program's input and not a
selection at all, so there is nothing for the clipboard to receive. The surface therefore needs the
convention every terminal emulator already uses — hold a modifier to select locally instead — and it
has to be discoverable, because an operator whose drag does nothing has no way to guess.

### One terminal server per terminal, and a bounded number of them

Since a server's terminal id is fixed at startup, "one server per device" and "several terminals held
at once" cannot both be true. A device therefore holds one server per held terminal, each
`--max-clients 1`.

This keeps the previous generation's single-writer property enforced by the server itself rather than
reimplemented above it, and it is why only half of that boundary is relaxed. The cost is process
count: the configured maximum is the number of terminal servers a device can hold at once, so it is
stated rather than assumed, and eviction closes the server with the session.

*Alternative considered.* One server per device with `--url-arg`, the connecting side naming the
terminal. It would hold the process count at one — but the attach it would still not save is
per-connection either way, and it makes the terminal id something a connection supplies. That is the
exact property the inherited boundary forbids, and the saving it buys is one `exec` against a cost
the measurement puts an order of magnitude above it.

### A grace period, not a cache — because attaching was measured and it is cheap

The first design here was a full warm-session pool with a replay ring buffer, on the assumption that
re-attaching was the expensive part of a Pane switch. The measurement in Context says otherwise: a
median attach is roughly a tenth to a quarter of a second, and it arrives with the whole screen
already painted. Two thirds of that design was paying for a problem that is not there.

What survives is the part that is nearly free: a session is held for a bounded grace period after its
browser leaves, so the common gesture — flip to another Pane, flip back — costs nothing. That is a
timer before a close, not a cache. What was cut is the replay ring as the *general* mechanism, because
the multiplexer's own attach repaint already is one; a bounded window remains only for the narrow case
a held session creates, where there is no new attach to repaint from.

The session maximum stays, for a different reason than caching: a held session is a held process, so
the number a device can hold at once has to be a stated bound rather than however many Panes an
operator happened to visit.

*Alternative considered.* No holding at all — every connection attaches fresh. Simpler still, and
defensible on the medians. It was not chosen because the grace period is a timer, the 1.9 s tail
sample shows the distribution has one, and a flip-back is the gesture most likely to hit it.

### The peer runs a terminal service; the lead never resolves a peer's terminal

Forced by the adapter dropping `terminal_id` before Pack. The peer's service takes a Pane id, resolves
it against its own local multiplexer server, starts exactly that terminal's server, and reports its
endpoint. It accepts no command, path, account, or terminal id from a request.

*Alternative considered.* Carrying `terminal_id` through the adapter, the Collie wire model and Pack so
the lead could resolve it. That is four upstream files including the Pack wire contract, it publishes
a terminal id to every consumer of the model, and it would make the lead able to name a terminal on a
machine it does not own. The peer-side service is more code and a smaller boundary.

### The terminal stream gets its own projection, not Pack's

Pack forwards HTTP requests, so a stream cannot ride it. The link gains a third `-R` projection, aimed
only at the peer's terminal service, on a Lead-side endpoint distinct from the Pack projection's, and
only when the peer's configuration declares one. A peer without a terminal endpoint publishes the same
two projections it publishes today and its argument list is unchanged.

The test that pins `sshLinkCommand` is extended rather than relaxed: it gains a case asserting the
three-projection form and keeps its existing case asserting the two-projection form byte for byte.

### Idle is reclaimed at two levels

A held session closes when its grace period expires, taking its terminal server with it. A peer's
terminal service stands itself down after a longer interval — one hour by default — once it holds no
server and has been asked for nothing, returning the peer to Collie plus the link.

The second level is what makes "closed by default" a property over time rather than only at startup:
a device nobody has used since yesterday holds no terminal machinery at all. The supervisor must
therefore treat a stood-down terminal child as idle rather than failed, which is why that is stated in
the runtime delta rather than left to the supervisor's existing restart policy.

### The switch is browser-local and global

Global because the operator asked for one mode, not a per-Pane memory to maintain; browser-local
because it is a preference about how this browser draws a Pane, not a fact about the deployment, and
`fleet/ui/native-navigation/preferences.ts` is the existing precedent for exactly that shape.

## Risks / Trade-offs

- ~~**Same-origin `wss:` might not be admitted by `connect-src 'self'`.**~~ Retired: measured in a
  browser against this app's exact CSP, with a cross-origin control proving the probe could fail. The
  CSP is unchanged by this work.
- **Held sessions are held processes.** → The maximum is configured and validated
  against declared bounds, eviction is least-recently-used, and each server exits with its session. A
  device's worst case is stated in its configuration rather than discovered in production.
- **A stood-down terminal service could be read as a crash.** → Status reports the terminal layer
  separately from the link, and the runtime delta requires an idle stand-down to be reported as idle.
- **The third projection widens what the peer's SSH key can bind on the lead.** → It is a distinct,
  loopback, terminal-only endpoint, validated to differ from the Pack projection's, refused when
  non-loopback, and published only when the peer's configuration declares it. Configuration validation
  fails before the connection is attempted.
- **A terminal is a write surface the mirror was not.** → The write gate the application already
  applies to a device governs it: where writes are refused, the terminal is established read-only and
  says so, rather than accepting input it discards.
- **The peer service is new privileged-adjacent code on a machine the lead does not own.** → Its
  contract is three operations with an exact grammar, it accepts no execution detail from a request,
  it binds only its own loopback endpoint, and it reads no Pack or browser trust material.

## Migration Plan

The lead path is built and verified first, because a peer's terminal traverses the lead's Gateway and
cannot be exercised end to end before it exists. Peer work follows on the same change.

Every stage is reversible by the switch: with it off, the pane route delegates to Collie's own element
and loader, no upgrade route is exercised, no session is created, and a peer that declares no terminal
endpoint runs the two children and two projections it runs today. Rolling back is deploying the
previous build; there is no state to unwind, because held sessions, terminal servers and retained
output are all live-only.

Deployment, device enrolment, terminal server acquisition, and the previous generation's retirement
belong to the consuming repository and are not part of this change.

## Re-verified against Collie 1.5.1

This change was held at planning while the upstream merge was done first. That merge has landed:
`FORK.toml` and `UPSTREAM.md` now record Collie **v1.5.1** (tag object `a326aedc`, commit
`ba39c05c`), adopted through the repository's own `fleet-upstream-sync` procedure. Every statement in
Context was originally read against v1.2.0, three minor releases earlier, so the whole list was run
again on 2026-09-05 against the merged tree. **All of it held**, and none of the design changed as a
result:

- **`web/src/router.tsx` is still claimed by no `FORK.toml` entry.** The whole port rests on this.
  The file did gain an upstream route (`settings/updates`), and the pane route's
  `{ id, path, loader, element }` shape is unchanged, so the swap lands exactly where it was planned.
- **`web/src/routes/root.tsx` still dates the connection bar through
  `useRouteLoaderData(PANE_ROUTE_ID)`, and `shownLastSeenAt` still branches on `pane.error`** — the
  branch the stub loader is shaped to. The file changed around it (`usePolling` now returns the
  cadence, and the update banner became `UpdateRibbon`); neither touches this.
- **`bridge/mux/herdr/adapter.ts` still drops `WirePane.terminal_id`, and `bridge/pack/` still carries
  it only in the `fake-herdr.ts` stub.** The adapter was not touched by the merge at all. The
  peer-side service therefore remains forced rather than chosen.
- **`fleet/pack-reachability.ts` still publishes exactly two projections**, and its specification
  still says so.
- **`bridge/server.ts`'s CSP is unchanged**: `default-src 'self'; connect-src 'self'`, no `frame-src`.
- **`web/src/components/agent-chat.tsx` still carries five ports under `native-manual-pane-fit-port`**,
  which is why the wrapper was chosen over a branch there.
- **`web/package.json` has gained no terminal renderer**, so that dependency is still this change's to
  add.

The multiplexer measurements were never Collie's to invalidate, and are unchanged.

One thing the merge did add that this change must now respect: adopting an upstream release is a
written procedure of its own (`openspec/specs/fleet-upstream-sync/spec.md`, with a
`bun scripts/check-fork.ts --target <tag>` preflight that reports every port a release disturbs).
This change adds one invasive path, so the next adoption will report it; its entry must carry a
reason good enough to review at that moment, not just at this one.

## Open Questions

- The session maximum, the grace period, and the retained-output bound have shapes fixed by the
  specs and values that are configuration. Their first values can be chosen during implementation and
  tuned afterwards without changing the specs, the approach, or the task breakdown.
