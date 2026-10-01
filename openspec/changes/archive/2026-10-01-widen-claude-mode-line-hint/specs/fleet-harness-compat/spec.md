## MODIFIED Requirements

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
