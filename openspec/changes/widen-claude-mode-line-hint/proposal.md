## Why

Claude Code 2.1.286 also prints its key hints on the mode line while the main turn runs with
background agents. After a message is sent into such a pane the mode line reads
`⏵⏵ bypass permissions on (shift+tab to cycle) · esc to interrupt · ← for agents · ↓ to manage`,
clipped with `…` in a narrow pane. The archived `exempt-claude-manage-hint` change removes the
trailing `↓ to manage` only when the segment before it is `← <digits> agent(s)`; here that segment is
`← for agents`, which carries no count, and `esc to interrupt` names a sendable key as well. So
both upstream tail checks still read the working screen as a dialog footer: the composer is refused
and the unread-dialog card covers the pane, the same symptom the earlier port fixed.

## What Changes

- Baseline: Collie `v1.15.0`, as recorded in `UPSTREAM.md`; this change adopts nothing.
- The fork-owned mode-line helper is widened: when a row's first `·` segment is Claude's
  permission-mode text, it drops any whole `esc to interrupt` segment and a trailing `↓ to manage`,
  either of them clipped with `…` when it is the last segment, but no shorter than `<key> to`. The
  agent-count requirement on the segment before `↓ to manage` is removed.
- Everything else is returned unchanged, so a dialog footer naming `↓ to manage` or `Esc to cancel`
  is still read as a dialog, and every other segment of the mode line keeps upstream's reading.
- Two helper tests that pinned the narrow rule ("no agent count", "a count that is not a number") are
  deliberately overturned.
- Synthetic fixtures for the new mode line (full at 120 columns and clipped), focused tests, the
  `FORK.toml` owned entry and invasive reason widened in step, one `### Fixed` CHANGELOG line.
- The port stays TEMPORARY, retired with the rest of the exemption at the sync that adopts a release
  in which upstream reads these hints itself.

Non-goals:

- No change to `menu-hints.ts`: `↓` and `esc` stay sendable keys for every harness and the generic
  menu.
- No new call site: the two existing one-line ports are unchanged.
- No new reading of the hints (no interrupt or manage action surfaced). No release and no tag.

Reused upstream behaviour: the Claude grammar, the unread-dialog card and its gating.
Fork-owned behaviour: the mode-line hint recogniser, its fixtures and tests.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-harness-compat`: the mode-line exemption covers Claude's `esc to interrupt` segment and a
  trailing `↓ to manage` without an agent count before it.

## Impact

- Code: `web/src/lib/fleet-claude-mode-line.ts` only; the ports in
  `web/src/lib/harness/claude/chrome.ts` and `web/src/lib/harness/claude/index.ts` are untouched.
- Tests: `web/src/lib/harness/claude/fleet-manage-hint.test.ts`; new synthetic fixtures
  `claude--v2286-agents-interrupt-manage-hint--w120.txt` and the clipped `--w93.txt` under
  `web/src/fixtures/fleet-panes/`.
- Boundary: the `claude-mode-line-compat` owned entry gains the fixtures and a widened contract; the
  `claude-manage-hint-port` invasive entry's reason and intent describe the wider rule. No new
  invasive path.
- Release axis when cut: PATCH (frontend bundle only).
