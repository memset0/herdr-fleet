## Context

`harness/codex/markers.ts` `isStyledStatusRow` recognises Codex's status row by its paint: an
unstyled two-space indent, then `field (sep field)*` where every field carries a foreground and every
separator is exactly ` · ` in ONE quiet paint (`dim`, `fg:<muted>`, or `plain` when no colour query
was answered, #294), optionally ending in a gap and a right-aligned notice that `isRightNotice`
accepts only when every segment carries a foreground or SGR 2.

A headless Codex 0.156.1 with a user-configured nine-item `status_line` (wider than the pane, so
truncated with `…`) parses into these segments (text masked):

```
"  " · <model> " · " <perm> " · " <title> " · " <cwd>␠ "· " <branch>␠ "· " <limit…> "  ⚠ "
<1 warning␠> "· " <f2␠ bold> "to view"
```

Three things break the paint test, all of them artefacts of the missing colour answer rather than of
a different row shape:

1. From the fourth item on, the space before the separator is painted in the item's colour, so the
   separator segment is `· `, not ` · `, and the field carries a trailing space.
2. The gap and the notice's `⚠ ` would differ in paint on a coloured screen (unstyled vs muted); with
   no muted colour both are unstyled, so the parser merges them into one segment `  ⚠ `, which is
   neither a gap nor a field.
3. The notice's glue text and its bold key lose the colours the theme answer would have given them,
   so `isRightNotice` sees unpainted segments and refuses — the rule's own comment says no headless
   notice had been captured, and `invariants.test.ts` pins this exact repaint as a known gap.

Codex declares no `modalOnScreen`, so `withUnreadDialog` treats an unread composer on an all-raw
screen as a dialog it cannot read.

## Goals / Non-Goals

**Goals:**
- The headless row reads exactly as its coloured twin does.
- A coloured row, a row with uncoloured fields, and every Codex dialog keep upstream's reading.
- The decision lives in a fork-owned module; the upstream file changes by the fewest lines that can
  reach the two private functions involved.

**Non-Goals:**
- Changing `isRightNotice`'s bounds, the field/separator rules, the busy-row or quiet-suffix rules.
- Teaching the composer locator, the hint row (0.157), or any dialog grammar anything.

## Decisions

1. **Normalise the segments, then let upstream judge them.** The helper
   `withFleetCodexStatusSegments(segments)` is applied to the folded segment list at the top of
   `isStyledStatusRow` and returns a new list with two repairs, each narrowly conditioned:
   - a segment that is not the first, carries no paint at all, and is two or more spaces followed by
     text is split into the space run and the text (both unpainted) — restoring the gap;
   - a segment carrying a foreground whose text ends in exactly one space after a non-space, directly
     followed by a segment whose text is exactly `· `, gives that space back: the field loses it, the
     separator becomes ` · ` in its own paint.
   Every other segment is copied unchanged, and `null` (nothing survived folding) passes through.
   Upstream's loop then applies all its own rules to the repaired list. Alternative rejected:
   accepting `· ` as a separator and a glued `  ⚠` as a gap inside the loop — that rewrites the loop.

2. **The unpainted-notice decision is the helper's; the port only asks.** `isRightNotice` gains one
   parameter — the row's separator paint, which the loop already holds as `paint` — and its single
   "unpainted segment ⇒ refuse" line asks `fleetReadsUnpaintedNotice(paint)` first. The helper answers
   true only for `plain`: when the row's own separators carry no paint, the theme answer was missing,
   and a notice segment without colour is what that looks like. A coloured or SGR 2 row still needs a
   fully painted notice; every other notice bound (segment count, length, no background, no inner
   gap, no leading space) is upstream's and unchanged. Alternative rejected: re-implementing the
   notice check in the helper and OR-ing it in at the call site — that duplicates upstream's bounds
   (and lets them drift) to save one line; and pre-marking unpainted segments as `dim` before the call
   would lie about the paint and, through `isGapSegment`, loosen the inner-gap rule.

3. **The port's footprint.** `codex/markers.ts`: one import, the normalising call, the parameter, the
   condition, the argument — five lines, anchored at
   `withFleetCodexStatusSegments(foldTrailingPadding(line.segments))`. `invariants.test.ts`: the
   known-gap entry for "no client attached" over `codex--v0156-draft-multiline.txt` is removed, as the
   suite's own comment asks once the reader learns the paint (left in, its `it.fails` turns red),
   replaced by a one-line comment naming the port that is its anchor. FORK.toml allows one anchor per
   invasive file; the reason field names every edited line.

4. **Where it lives.** `web/src/lib/fleet-codex-status-row.ts` beside `fleet-claude-mode-line.ts`,
   with its suite at `web/src/lib/harness/codex/fleet-headless-status-row.test.ts` and fixtures in
   `web/src/fixtures/fleet-panes/` (outside upstream's non-recursive corpus glob and its pinned codex
   list). FORK.toml's owned globs are `dir/**` or exact paths and an owned path may match only one
   entry, so `claude-mode-line-compat` is narrowed from the fixture directory to its two exact
   fixtures and the new `codex-status-row-compat` lists its own exact paths; each temporary port can
   then be retired without touching the other's fixtures.

5. **Fixtures are synthetic.** Hand-built in the captured shape (same segment boundaries and paint,
   Codex's default theme colours as upstream's 0.156.1 fixtures carry them), with neutral text: a
   model name and paths in the style of upstream's corpus, an English thread title, no real path,
   branch or title. One is the truncated nine-item row (six items visible, the sixth clipped with
   `…`), one a five-item row that fits; both end in `⚠ 1 warning · f2 to view`.

## Risks / Trade-offs

- [The `plain` relaxation admits more rows] A transcript row indented two spaces with coloured words,
  plain ` · ` between them and plain words after a gap now passes the row test. → It is the same
  class upstream accepted for #294 (`a reply row with coloured words and a plain ` · ``): the row test
  is never decisive alone; the composer locator's tail shape keeps a reply row from claiming the
  composer. The fixtures' tests and upstream's fail-closed suite both stay green.
- [Codex changes the rendering again] The repairs stop applying and the symptom returns, which is the
  fail-closed direction (a stalled send and the card, not a keystroke into a modal).
- **The port is temporary.** Retired at the first upstream sync that adopts a release reading
  headless multi-item status rows: the markers.ts lines return to upstream's text, the invariants
  entry follows upstream, and the helper, its suite, its fixtures, the `[[invasive]]` and `[[owned]]`
  entries and the requirement are removed. The invasive entry's intent and reason say so.

## Migration Plan

Frontend bundle only; a rebuild on the lead is live. Rollback is reverting the commit.
