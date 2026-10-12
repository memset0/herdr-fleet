## Context

See proposal.md for motivation. The baseline is Collie v1.19.0. Fleet already owns the Gateway, scoped terminal references, native navigation shell, and its locale dictionaries. Collie pins intentionally remain browser-local.

## Goals / Non-Goals

**Goals:** reuse those seams, keep slot identity independent of layout, and deliver both browser features from the lead alone.

**Non-Goals:** change native pin storage, multiplexer focus, member wire surfaces, or terminal lifecycle.

## Decisions

- One fork-owned view-state endpoint behind existing Gateway session/origin gates. Selection is process-local with a generation identifier and monotonically increasing revision; writes are serialized in lead arrival order. Persist only positional favorites next to existing operator association documents using atomic owner-only writes. Existing storage helper avoids another filesystem implementation.
- Slots are one shared cross-member layout, initially three rows by four columns, adjustable from one to six each. Use per-slot expected-reference comparisons, so edits to different slots compose and conflicting edits to one slot refuse with current state. Resizing compares the current shape and refuses a shrink that would discard occupied slots, with a clear instruction to clear them first. The same terminal occupies at most one slot; moving it clears its prior slot. Native stars stay independent because positional assignment and upstream per-browser pinning have different storage contracts.
- Widen snapshots to all sessions for each reachable member using Collie's existing snapshot API. Retain last observations as stale on errors, never authorize navigation/assignment from them. Resolve references using the existing unique/fresh contract; identity-less Agents remain visible but cannot be assigned or synchronized.
- One browser provider polls while visible, at 1.5 seconds, only for the panel or an opted-in stream. The control is in the existing hierarchy footer and panel toolbar. Joining reads first; a follower route is marked before navigation and consumed without publishing. A reconnect reads current lead state before considering local changes. No offline write queue.
- Fullscreen is a route layout, not the browser fullscreen API. An owned shell branch replaces normal chrome at `/panel`; a narrow router entry and navigation ancestry port are the only new upstream edits. Existing buttons, Agent icon, status dot, text formatting, and locale mechanism are reused.
- The hierarchy footer offers a small grid icon beside the build version, below the existing Collie/TTYD switch. A compact selection-stream control shares that version row; neither alters the surface switch's row. Glyphs remain small within native touch targets.
- In portrait the queue owns the lower half; in landscape it owns the right portion. Grid and queue scroll independently, with readable minimum tile sizes instead of allowing large dimensions to squeeze away the queue. Row/column controls and exit sit at the queue's end. Queue rows reuse the owned native Agent card with an optional trailing action port.
- Live status transitions trigger bounded colored tile feedback, including a green check for completion. The transition is keyed by terminal identity, never fired on initial load, assignment or stale recovery. Reduced motion keeps a static colored check instead of motion. A joined panel remains a controller: taps publish the central selection and highlight it without leaving the panel; normal joined pages follow the Pane route.
- Touch drag uses a long-press drag handle and pointer capture; scroll before hold cancels, pointer cancellation aborts, hit testing selects a square, and edge scrolling keeps distant slots reachable. Mouse dragging arms on movement. Tap-to-select Agent then tap-slot is the keyboard and accessible alternative. Slot dimensions use CSS aspect ratio, not measured JavaScript sizes.
- All new logic, tests and dictionaries are fork-owned. FORK.toml records router and navigation ancestry anchors and verification paths. No new third-party dependency.
- Verification refinement: the upstream Windows-shim test uses a real installed tool's name, so its Linux negative case can accidentally find the host's executable fallback. Use a synthetic fixture executable name in that test group with its assertions unchanged, and record this validation-only path in FORK.toml. No tool lookup behavior changes.
- The compiled CLI's loose-install fixture also assumes a non-root directory owner. Set that disposable directory's owner to a synthetic non-root UID when running as root, so the existing intended ownership predicates and assertions remain true. This is a second verification-only port, with no product install classification change.
- The owned version-evidence test drains its pending cache writes before uninstalling the fake database, preventing a late transaction event from escaping into the next test environment. Its version assertions and runtime behavior remain unchanged.
- The upstream offline-page fixture preloads its fresh module graph in setup, after resetting modules and installing its empty database. This keeps initial module transformation outside the five-second interaction deadline without changing its cold-page state, assertions or production code.

## Risks / Trade-offs

- Polling gives bounded follow latency rather than an immediate push → reuse a short existing-style cadence, pause hidden pages, serialize reads, and refresh on wake.
- A session can go away during navigation → resolve only fresh unique references and keep unavailable assignments visibly intact.
- Unified slots differ from browser stars → name them panel slots and leave native stars unchanged.
- Touch scrolling conflicts with dragging → hold on a dedicated handle, explicit cancellation and auto-scroll tests.

## Migration Plan

No enrollment or data migration. Build and verify the lead, restart only its Fleet plugin to load Gateway code, and assess this as a patch under the product's lead-only release axis. No peer redeployment is required. Rollback the product commit; the optional new slot document can remain without affecting older builds. Archive follows tests and audits; release and deployment use the product working agreement.
