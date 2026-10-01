# fleet-harness-compat Specification

## Purpose
Keeps Collie's harness grammars reading a newer agent screen correctly where the adopted upstream
release does not yet, through narrow fork-owned exemptions that leave every other reading unchanged.

## Requirements

### Requirement: Claude's background-work hint on the mode line is not a dialog key hint
When a Claude pane's mode line begins with the permission-mode text (for example
`⏵⏵ bypass permissions on (shift+tab to cycle)`), Herdr Fleet SHALL NOT read Claude's own key hints
on that line as dialog footer hints. Those hints are an `esc to interrupt` segment anywhere after the
mode text, and a trailing `↓ to manage` segment, whatever precedes it (for example `← 2 agents` or
`← for agents`). This holds for each hint whole and, when it is the last segment, clipped by the
terminal with a trailing `…` but no shorter than `<key> to` (for example `↓ to ma…`), and with
right-aligned notice text after the line. On such a screen with a live input box the composer SHALL
be ready and the screen SHALL NOT be reported as an unread modal, exactly as on the same screen
without those segments.

The exemption SHALL be limited to those two hints on the permission-mode line. A `↓ to <verb>` or
`Esc to <verb>` hint anywhere else — in a dialog footer, alone on a row, or on a row that is not the
permission-mode line — SHALL keep its upstream reading, a `↓ to manage` that is not the last segment
SHALL keep its upstream reading, and every other key hint on the mode line SHALL keep its upstream
reading. No other harness changes.

This exemption is a temporary compatibility port for Claude Code 2.1.286 and holds only until
upstream reads the hints itself; the port is retired at the sync that adopts that release.

#### Scenario: Working screen with the full hint
- **WHEN** a Claude pane shows a live input box and its mode line reads
  `⏵⏵ bypass permissions on (shift+tab to cycle) · ← 2 agents · ↓ to manage`
- **THEN** the composer is ready, the screen is not reported as a modal, and no unread-dialog card
  is drawn

#### Scenario: Working screen with the clipped hint
- **WHEN** the same mode line is clipped by a narrow pane to `… · ← 2 agents · ↓ to ma…`
- **THEN** the composer is ready, the screen is not reported as a modal, and no unread-dialog card
  is drawn

#### Scenario: Working screen with the interrupt and agents hints
- **WHEN** a Claude pane shows a live input box and its mode line reads
  `⏵⏵ bypass permissions on (shift+tab to cycle) · esc to interrupt · ← for agents · ↓ to manage`,
  whole or clipped to `↓ to ma…`
- **THEN** the composer is ready, the screen is not reported as a modal, and no unread-dialog card
  is drawn

#### Scenario: Only one of the two hints
- **WHEN** the mode line carries `esc to interrupt` without `↓ to manage`, or `↓ to manage` without
  an agent count before it
- **THEN** the composer is ready and the screen is not reported as a modal

#### Scenario: A real dialog whose footer uses an arrow key is still a dialog
- **WHEN** a Claude dialog's footer names a key with `↓` or `↑` (for example
  `↑/↓ to select · Enter to view · Esc to close`, or `↓ to manage` alone on the footer row)
- **THEN** the composer is not ready and the screen is reported as a modal, as upstream reads it

#### Scenario: A dialog footer naming Esc is still a dialog
- **WHEN** a Claude dialog's footer reads `Esc to cancel`, or the mode line's last segment is
  `Esc to cancel` after `↓ to manage`
- **THEN** the row is read as naming a menu key, as upstream reads it

#### Scenario: The segment outside the mode line keeps its reading
- **WHEN** a row carries `← 2 agents · ↓ to manage` or `esc to interrupt` without the
  permission-mode text before it
- **THEN** the row is read as naming a menu key, as upstream reads it

### Requirement: Codex's headless multi-item status row is read as a status row
When a Codex pane draws its status row with coloured items but with separators and glue text that
carry no paint — as Codex does when no colour query was answered — Herdr Fleet SHALL read that row
as Codex's status row, including when:

- the row has more than three items and, from the fourth item on, the space before a ` · `
  separator is painted in the preceding item's colour;
- the row is truncated by the terminal with `…`;
- a right-aligned notice (for example `⚠ 1 warning · f2 to view`) follows a gap, with the gap and
  the notice's first glyph drawn as one unpainted run, and the notice's glue text and key drawn
  without colour.

On such a screen with a live composer the composer SHALL be ready and no unread-dialog card SHALL be
drawn, exactly as on the same screen drawn with colour.

The relaxation SHALL be limited to rows whose separators are all unpainted. A row whose separators
carry a colour or SGR 2 SHALL keep requiring every notice segment painted; a row whose items carry no
colour SHALL still be refused; and every screen Collie's Codex grammar reads as a dialog SHALL keep
its upstream reading. No other harness changes.

This exemption is a temporary compatibility port for Codex's headless status row and holds only
until upstream reads such rows itself; the port is retired at the sync that adopts that release.

#### Scenario: Truncated nine-item headless row with a notice
- **WHEN** an idle Codex pane with no colour answered shows a live composer above a status row of
  nine configured items, truncated with `…`, followed by a right-aligned `⚠ 1 warning · f2 to view`
- **THEN** the composer is ready and no unread-dialog card is drawn

#### Scenario: Shorter untruncated headless row with a notice
- **WHEN** the same pane's status row has five items, not truncated, followed by the same notice
- **THEN** the composer is ready and no unread-dialog card is drawn

#### Scenario: A coloured row keeps requiring a painted notice
- **WHEN** a status row's separators carry a muted colour and its right-aligned notice contains a
  segment with no colour
- **THEN** the row is not read as a status row, as upstream reads it

#### Scenario: A Codex dialog is still a dialog
- **WHEN** a Codex approval or trust prompt is on screen
- **THEN** the composer is not ready and the dialog is lifted as upstream reads it
