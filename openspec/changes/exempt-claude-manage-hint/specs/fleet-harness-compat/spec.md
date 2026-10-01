## Purpose

Keeps Collie's harness grammars reading a newer agent screen correctly where the adopted upstream
release does not yet, through narrow fork-owned exemptions that leave every other reading unchanged.

## ADDED Requirements

### Requirement: Claude's background-work hint on the mode line is not a dialog key hint
When a Claude pane's mode line ends with the background-work segment `← N agent(s) · ↓ to manage`,
following the permission-mode text (for example `⏵⏵ bypass permissions on (shift+tab to cycle)`),
Herdr Fleet SHALL NOT read that segment as a dialog footer hint. This holds for the whole segment
and for the segment clipped by the terminal with a trailing `…` (for example `↓ to ma…`), and with
right-aligned notice text after it. On such a screen with a live input box the composer SHALL be
ready and the screen SHALL NOT be reported as an unread modal, exactly as on the same screen without
the segment.

The exemption SHALL be limited to that segment in that position. A `↓ to <verb>` hint anywhere
else — in a dialog footer, alone on a row, or on a row that is not the permission-mode line — SHALL
keep its upstream reading, and every other key hint on the mode line SHALL keep its upstream
reading. No other harness changes.

This exemption is a temporary compatibility port for Claude Code 2.1.286 and holds only until
upstream reads the hint itself; the port is retired at the sync that adopts that release.

#### Scenario: Working screen with the full hint
- **WHEN** a Claude pane shows a live input box and its mode line reads
  `⏵⏵ bypass permissions on (shift+tab to cycle) · ← 2 agents · ↓ to manage`
- **THEN** the composer is ready, the screen is not reported as a modal, and no unread-dialog card
  is drawn

#### Scenario: Working screen with the clipped hint
- **WHEN** the same mode line is clipped by a narrow pane to `… · ← 2 agents · ↓ to ma…`
- **THEN** the composer is ready, the screen is not reported as a modal, and no unread-dialog card
  is drawn

#### Scenario: A real dialog whose footer uses an arrow key is still a dialog
- **WHEN** a Claude dialog's footer names a key with `↓` or `↑` (for example
  `↑/↓ to select · Enter to view · Esc to close`, or `↓ to manage` alone on the footer row)
- **THEN** the composer is not ready and the screen is reported as a modal, as upstream reads it

#### Scenario: The segment outside the mode line keeps its reading
- **WHEN** a row carries `← 2 agents · ↓ to manage` without the permission-mode text before it
- **THEN** the row is read as naming a menu key, as upstream reads it
