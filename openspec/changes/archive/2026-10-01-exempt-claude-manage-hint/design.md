## Context

Two upstream-owned checks in the Claude grammar ask `namesAMenuKey(row)` of the rows at the bottom of
the screen:

- `harness/claude/chrome.ts` `tailNamesAMenu`, used by `locateInputBox` step 4 for every row under
  the input box's bottom border. A hit refuses the box, so `hasInputBox` (the adapter's
  `composerReady`) is false.
- `harness/claude/index.ts` `tailNamesAKey`, the adapter's `modalOnScreen`, over the last six
  non-blank rows.

`withUnreadDialog` draws the unread-dialog card when the composer is not ready, the adapter reports a
modal and no grammar claimed the screen. `namesAMenuKey` splits on ` · ` and maps `↓` to `Down`
(`menu-hints.ts`), so Claude Code 2.1.286's mode-line suffix `· ← N agents · ↓ to manage` trips both
checks on a healthy working screen. Upstream's corpus only has `· ← 1 agent` and `· ← for agents`,
neither of which names a key.

## Goals / Non-Goals

**Goals:**
- The working screen with the suffix, whole or clipped with `…`, reads exactly as it does without it.
- Any `↓` hint that is not this suffix on the permission-mode line keeps upstream's reading.
- Two one-line ports; all logic in a fork-owned module.

**Non-Goals:**
- Teaching `menu-hints.ts` anything: it is shared by every harness and by the generic menu.
- Recognising other new mode-line segments speculatively.

## Decisions

1. **Strip the segment, then ask the upstream question.** The helper
   `withoutClaudeManageHint(row)` returns the row minus the trailing `· ↓ to manage` segment when it
   is Claude's background-work hint, and the row unchanged otherwise. Each upstream call becomes
   `namesAMenuKey(withoutClaudeManageHint(row))`. Stripping (rather than a boolean "exempt" that
   short-circuits) keeps every other segment of the same row under upstream's test, so a real key
   hint that somehow shared the row is still seen. Alternative rejected: changing `menuKeyFor` or
   `namesAMenuKey` — that would change every harness and the generic menu.

2. **What the segment is.** On the row split by upstream's own `SEGMENT_SPLIT`:
   - the first segment is the permission-mode text: one or more `⏵`/`⏸` glyphs, words, `on`, and
     optionally `(shift+tab to cycle)` — the shape every upstream mode-line fixture carries
     (`bypass permissions on`, `accept edits on`, `plan mode on`, `auto mode on`, `manual mode on`);
   - the segment before the last is `← <digits> agent` or `← <digits> agents`;
   - the last segment is `↓ to manage`, or a prefix of it of at least `↓ to` followed by `…`
     (the terminal's clip), optionally followed by two or more spaces and right-aligned notice text
     (Claude right-aligns notices such as `new task? /clear to save …` on the same row).
   A clip shorter than `↓ to` (`↓ t…`, `↓…`) does not parse as a hint upstream and needs no exemption.
   Any intermediate segments stay in the returned row.

3. **Where it lives.** `web/src/lib/fleet-claude-mode-line.ts`, beside the other `fleet-*` web
   modules, declared with its test and fixtures in a new `[[owned]]` entry. It imports
   `SEGMENT_SPLIT` from `menu-hints.ts` so the split rule cannot drift. Alternative considered:
   `fleet/ui/…` — rejected because the fixtures and the vitest suite are web-side and an owned path
   may match only one entry; keeping all three under one entry keeps the boundary in one place.

4. **Fixtures are synthetic and outside upstream's corpus directory.** Upstream suites glob
   `web/src/fixtures/panes/*.txt` (non-recursively) and pin every Claude fixture in hand-curated
   tables; putting ours in `web/src/fixtures/fleet-panes/` avoids touching those tables. They are
   hand-built in the shape of upstream's `claude--draft-footer-single.txt` (SGR-only, generic text),
   at a 120-column full hint and a 73-column clipped one.

5. **The `↓` dialog that must stay a dialog.** No upstream Claude fixture's detection depends on a
   bare `↓ to <verb>` alone; the closest real dialogs whose footers use arrow hints are
   `claude-lab--tasks-panel--w82.txt` (`↑/↓ to select · Enter to view · Esc to close`) and
   `claude-lab--menu-config-panel--w82.txt` (`Enter/↓ to select · ↑ to tabs · …`). The tests assert
   both are still modal and not composer-ready, plus a variant of the tasks panel whose footer is
   `↓ to manage` alone, which is detected only through the `↓` hint — that is the case a too-broad
   exemption would break.

## Risks / Trade-offs

- A future Claude may reword the suffix (`↓ to view`, a new count noun). The exemption then stops
  applying and the old symptom returns, which is the fail-closed direction (a stalled send, not a
  keystroke into a modal). The fixture and the `[[invasive]]` entry make it visible at the next sync.
- **The port is temporary.** It is a compatibility port for Claude Code 2.1.286 until upstream reads
  the hint itself; an upstream pull request will be opened from the owner's own fork of Collie. At
  the first upstream sync that adopts a release carrying that fix, the two ports, the helper, its
  test and fixtures and the `[[invasive]]` and `[[owned]]` entries are removed, and the requirement
  is retired. The invasive entry's intent and reason say so, so the sync's review finds it.
