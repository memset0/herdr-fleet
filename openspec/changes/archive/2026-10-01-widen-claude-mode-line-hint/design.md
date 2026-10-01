## Context

`withoutClaudeManageHint` (fork-owned, `web/src/lib/fleet-claude-mode-line.ts`) is called by the two
upstream Claude tail checks before they ask `namesAMenuKey(row)`: the input-box locator's
`tailNamesAMenu` and the adapter's `modalOnScreen` scan (`claude-manage-hint-port`). It currently
removes `· ↓ to manage` only when the row is `<mode text> · … · ← <digits> agent(s) · ↓ to manage`.

A Claude Code 2.1.286 pane that is working on the main turn with background agents prints a longer
mode line:

    ⏵⏵ bypass permissions on (shift+tab to cycle) · esc to interrupt · ← for agents · ↓ to manage

`esc` maps to `Escape` and `↓` to `Down` in `menuKeyFor`, so both segments name a sendable key, and
`← for agents` is not a count, so the current helper returns the row unchanged. A captured screen
(private, not committed) confirmed the card and the empty mirror; a widened helper replayed against
it read the screen as ready.

## Goals / Non-Goals

**Goals:**
- That mode line, whole or clipped, reads exactly as the same screen without the two hints.
- A screen carrying only one of the two hints reads the same way.
- Dialog footers keep upstream's reading, including `↓ to manage` alone and `Esc to cancel`.

**Non-Goals:**
- Teaching `menu-hints.ts`, adding call sites, or recognising other future mode-line segments.

## Decisions

1. **Key the rule on the mode text, not on the count.** The first segment being the permission-mode
   text (the same `MODE_TEXT` shape as before) is what makes the row Claude's mode line; no dialog
   footer starts with it. The `← <digits> agent(s)` requirement added nothing to that and is what
   missed `← for agents`, so it is dropped. Alternative rejected: also accepting `← for agents` as a
   count form — it would leave `esc to interrupt` unread and keep coupling the rule to a noun Claude
   has already changed once.

2. **Exactly two hints, matched whole and case-sensitively.** `esc to interrupt` is removed wherever
   it stands after the mode text; `↓ to manage` only as the last segment, as before. Either may be
   clipped with `…` only when it is the last segment (the terminal clips at the row's end), and the
   clip must keep at least `<key> to` (`↓ to…`, `esc to…`) — a shorter clip does not parse as a hint
   upstream and needs no exemption. `Esc to cancel` (another verb, Claude's dialog casing) and
   `↓ to manage` in any non-last position are kept, so those still read as key hints.

3. **Rejoin with the canonical separator.** The kept segments are joined with ` · `. Only the
   question "does any segment name a key" is asked of the result, so normalising separator spacing
   is immaterial; a right-aligned notice after a run of padding is still set aside first and kept.

4. **Tests overturned on purpose.** The two `returns the row unchanged` cases "no agent count before
   it" and "a count that is not a number" encoded the narrow rule; they now assert the hint is
   dropped. The `hint not last` case stays (a trailing `Esc to cancel` keeps the row naming a key).

5. **Fixtures.** Synthetic, in the shape of the existing `claude--manage-hint--w120.txt` (SGR-only,
   generic text), under `web/src/fixtures/fleet-panes/` so upstream's hand-curated corpus tables are
   untouched: `claude--v2286-agents-interrupt-manage-hint--w120.txt` (full) and
   `claude--v2286-agents-interrupt-manage-hint--w93.txt` (clipped to `↓ to ma…` at 93 columns).

## Risks / Trade-offs

- Dropping the count requirement widens the exemption to any `<mode text> · … · ↓ to manage` row.
  No Claude dialog footer begins with the permission-mode text, and the mode line is Claude's own
  chrome, so the fail-open risk is limited to Claude printing a real dialog hint on its mode line,
  which no captured screen shows.
- A future reword (`esc to stop`) stops matching and the old symptom returns — the fail-closed
  direction (a stalled send, not a keystroke into a modal).
- **The port stays temporary**, retired with the helper, fixtures and both `FORK.toml` entries at
  the first upstream sync whose release reads these hints itself.
