## Why

Claude Code 2.1.286 appends a background-work hint to its mode line while background agents or
tasks run: `⏵⏵ bypass permissions on (shift+tab to cycle) · ← 2 agents · ↓ to manage`, clipped to
`↓ to ma…` in a narrow pane. Collie's Claude grammar reads any `·`-separated `<key> to <verb>`
segment whose key it can send as a dialog footer hint, and `↓` is a sendable key. So on an ordinary
working screen the input box is refused (`composerReady` false, every send stalls) and the tail is
read as a modal (`modalOnScreen` true), and the pane is covered by the "Collie cannot read this
dialog" card. Upstream's fixtures carry only `· ← 1 agent`, and upstream `main` has no fix as of
this change.

## What Changes

- Baseline: Collie `v1.14.2`, as recorded in `UPSTREAM.md`; this change adopts nothing.
- One fork-owned helper recognises the trailing mode-line segment `← N agent(s) · ↓ to manage`
  (whole, or clipped with `…`) when it follows Claude's permission-mode text, and returns the row
  without it. Every other row, and every `↓ to <verb>` that is not in that position, is returned
  unchanged.
- Claude's two statusline-tail checks pass the row through that helper before asking whether it
  names a menu key: the input-box locator's "no tail row names a menu" step, and the adapter's
  `modalOnScreen` tail scan. Each is a one-line port in an upstream-owned file.
- The port is TEMPORARY: a compatibility port for Claude Code 2.1.286, retired at the first upstream
  sync that adopts a release in which upstream reads the hint itself (an upstream pull request will
  be opened separately).
- Synthetic fixtures (full and clipped hint) and focused tests; a `[[invasive]]` entry in
  `FORK.toml`; one `### Fixed` CHANGELOG line.

Non-goals:

- No change to `menu-hints.ts`: `↓` stays a sendable key, and every other harness, dialog grammar
  and the generic menu keep reading `↓ to <verb>` exactly as upstream does.
- No new reading of the hint (no "manage agents" action, no agent count surfaced).
- No release and no tag; the release decision is separate.

Reused upstream behaviour: the whole Claude grammar, the unread-dialog card and its gating.
Fork-owned behaviour: the mode-line segment recogniser and its tests.

## Capabilities

### New Capabilities

- `fleet-harness-compat`: how the fork keeps Collie's harness grammars reading a newer agent screen
  correctly where upstream does not yet; first requirement — Claude's background-work hint on the
  mode line is not a dialog key hint.

### Modified Capabilities

None.

## Impact

- Code: new `web/src/lib/fleet-claude-mode-line.ts`; one-line ports in
  `web/src/lib/harness/claude/chrome.ts` (`tailNamesAMenu`) and `web/src/lib/harness/claude/index.ts`
  (`tailNamesAKey`).
- Tests: new `web/src/lib/harness/claude/fleet-manage-hint.test.ts` and synthetic fixtures under
  `web/src/fixtures/fleet-panes/`.
- Boundary: a new `[[owned]]` entry for those paths and a new `[[invasive]]` entry
  `claude-manage-hint-port` for the two ports.
- Release axis when cut: PATCH (frontend bundle only).
