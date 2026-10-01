## MODIFIED Requirements

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

The exemption SHALL compose with the adopted Collie's own reading of the status row rather than
replace it. Since Collie 1.15.0 upstream reads a right-aligned notice whose padding is painted in the
colour of the field before it (a Codex goal notice such as `Pursuing goal (…)`); that row, and every
other row upstream reads as a status row, SHALL keep upstream's reading with the exemption in place,
and the exemption SHALL apply to what upstream's reading leaves of the row.

The relaxation SHALL be limited to rows whose separators are all unpainted. A row whose separators
carry a colour or SGR 2 SHALL keep requiring every notice segment painted; a row whose items carry no
colour SHALL still be refused; and every screen Collie's Codex grammar reads as a dialog SHALL keep
its upstream reading. No other harness changes.

This exemption is a temporary compatibility port for Codex's headless status row and holds only
until upstream reads such rows itself; Collie 1.15.0 does not yet, so the port stays, and it is
retired at the sync that adopts the release that does.

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

#### Scenario: Upstream's painted notice padding keeps its reading
- **WHEN** a Codex pane's status row ends with a right-aligned goal notice whose padding is painted in
  the colour of the field before it, as Collie 1.15.0 reads it
- **THEN** the composer is ready and no unread-dialog card is drawn, exactly as upstream reads that
  screen without the exemption

#### Scenario: A Codex dialog is still a dialog
- **WHEN** a Codex approval or trust prompt is on screen
- **THEN** the composer is not ready and the dialog is lifted as upstream reads it
