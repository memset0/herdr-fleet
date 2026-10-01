## Why

A Codex 0.156.1 pane started with no Herdr client attached (so no colour query is answered) and
configured with a multi-item `status_line` draws a status row Collie's Codex grammar does not
recognise: the composer is reported not ready, every send stalls, and because Codex declares no
`modalOnScreen` the idle pane is covered by the "Collie cannot read this dialog" card. Upstream's
own comments say no headless capture with a right-aligned notice existed; its paint-invariance
suite pins exactly this repaint as a known gap. Upstream `main` has no fix as of this change.

## What Changes

- Baseline: Collie `v1.14.2`, as recorded in `UPSTREAM.md`; this change adopts nothing.
- Three headless renderings are read as Codex draws them, and nothing else changes:
  - from the fourth item on, the space before a `·` separator is painted in the preceding item's
    colour, so the separator arrives as `· ` with its leading space glued to the field;
  - the gap before the right-aligned notice and the notice's first glyph (`⚠ `) arrive as one
    unpainted segment;
  - the notice's glue text (`⚠ `, ` · `, ` to view`) and its key (`f2`, bold) carry no colour,
    because the theme colours they would carry were never answered.
- A fork-owned helper normalises the first two (the gap is split off the glued segment; the field's
  trailing space is moved back onto its separator) before Codex's status-row test reads the row, and
  decides the third: a right-aligned notice may carry unpainted segments only when the row's own
  separators are unpainted. Upstream's status-row test keeps every other rule unchanged.
- The paint-invariance suite's known gap for this repaint ("a right-aligned notice with no colour,
  no capture yet") is closed and its entry removed, as the suite itself instructs.
- The port is TEMPORARY: a compatibility port until upstream reads headless multi-item status rows
  itself, retired at the first upstream sync that adopts that release (an upstream issue / pull
  request will be opened separately).
- Synthetic fixtures (a truncated nine-item row and a shorter untruncated row, both with a notice)
  and focused tests; `[[owned]]` and `[[invasive]]` entries in `FORK.toml`; one `### Fixed`
  CHANGELOG line.

Non-goals:

- No change to the coloured reading: a row whose separators carry a muted colour or SGR 2 still
  requires every notice segment painted.
- No acceptance of a status row whose fields themselves carry no colour (still prose by design).
- No `modalOnScreen` for Codex, no change to Codex's dialog grammars, no other harness touched.
- No release and no tag; the release decision is separate.

Reused upstream behaviour: Codex's whole status-row grammar, composer locator, dialog grammars and
the unread-dialog card. Fork-owned behaviour: the segment normalisation and the unpainted-notice
decision, with their tests.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-harness-compat`: adds a temporary requirement — Codex's headless multi-item status row,
  with or without a right-aligned notice, is read as a status row.

## Impact

- Code: new `web/src/lib/fleet-codex-status-row.ts`; a narrow port in
  `web/src/lib/harness/codex/markers.ts` (the import, the normalising call in `isStyledStatusRow`,
  and the row's separator paint passed to `isRightNotice`, which asks the helper before refusing an
  unpainted segment).
- Tests: new `web/src/lib/harness/codex/fleet-headless-status-row.test.ts` and synthetic fixtures
  under `web/src/fixtures/fleet-panes/`; the closed known-gap entry removed from
  `web/src/lib/harness/invariants.test.ts`.
- Boundary: a new `[[owned]]` entry `codex-status-row-compat`, the existing
  `claude-mode-line-compat` entry narrowed from the fixture directory to its own two fixtures, and a
  new `[[invasive]]` entry `codex-headless-status-row-port`.
- Release axis when cut: PATCH (frontend bundle only).
