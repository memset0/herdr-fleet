## Context

See proposal.md — Why. Only the exact shape of what moved matters here, because the fix is a revert
and the interesting part is the boundary that should have caught it.

**What upstream changed.** Commit `28255ae` gave the Pane and history routes a centred 768px column
from the `md` breakpoint up, added a third header width claim (`wide`) for them to match, and capped
bottom sheets at the 640px column. Verified against `857660b^`, the tree immediately before the
adoption, the two route wrappers were:

- `agent-chat.tsx`: `flex min-h-0 w-full min-w-0 max-w-[100dvw] flex-1 flex-col overflow-x-hidden`
- `history.tsx`: `flex min-h-0 flex-1 flex-col`

and neither route passed a `width` claim at all, so both took the header's default, `full`.

**Why nothing caught it.** The adoption's preflight reports the ports a release disturbs. The fork's
existing shell port declares the content-cap removal on `home`, `space`, `settings` and `pack` —
where a cap existed and was taken out. The Pane page never had one to remove, so it had no declared
line, so upstream adding one disturbed nothing the manifest knew about. The archived
`adopt-collie-1-5-1` change says nothing about width or a centred column.

## Goals / Non-Goals

**Goals:**

- Put the Pane and history routes back on the route column's full width.
- Leave a declared boundary where there was none, so the next release argues rather than inherits.
- Change the requirement from a description of a tree into a rule about a known upstream behaviour.

**Non-Goals:**

- Litigating 768px as a reading width. If the operator later wants a cap, it will be a decision with
  an entry behind it; what this change refuses is a cap nobody chose.
- Any behaviour below the `md` breakpoint, where upstream's change did nothing.

## Decisions

### Decline the claim rather than delete the option

`app-header.tsx`'s `wide` claim stays exactly where upstream put it, and this fork's routes simply
stop passing it. Deleting an upstream option would be a wider edit on a file the fork already touches
for other reasons, it would conflict on every future sync of that file, and a later fork surface may
legitimately want a 768px header. Not using something is the narrowest possible refusal.

The same reasoning keeps upstream's bottom-sheet cap: a sheet over a dimmed page is a different
surface from a reading column, upstream's argument for it does not depend on the rails, and nothing
about it was reported as wrong.

### The boundary is the point, not the revert

Reverting two class strings takes minutes and would be undone by the next adoption that touches those
lines, silently, the same way. So the manifest entry is the deliverable and the revert is its
occasion. `agent-chat.tsx` is already attributed to `native-manual-pane-fit-port`, and the manifest
allows one entry per path, so that half rides its reason as the sixth port on that file.
`history.tsx` is attributed to nothing and takes an entry of its own.

Both land in the same commit as the lines they describe, per the rule that a manifest describing last
week's tree is worse than none.

### The requirement is sharpened, not merely satisfied

Restoring the width makes the tree satisfy the sentence that is already written. That would leave the
specification exactly as unable to catch this as it was. "Keep their existing full-width presentation"
was true of a tree where upstream had no cap; it is a description, and a description of a moving tree
stops being a rule the moment the tree moves.

So the requirement now says what it means: no route centres itself, the Pane and history routes
included, *because upstream centres them and this fork declines that*, with the rails named as the
reason the width is not empty. A reader who meets upstream's cap in a future release now finds the
argument already made, in the place they would look.

## Risks / Trade-offs

- **The fork diverges further from upstream on a file it already ports.** → By two class strings, on
  lines the manifest now declares, with the provenance of what is declined recorded. That is the
  cheapest form this divergence can take, and it is visible rather than accidental.
- **An 80-column mirror on a very wide screen now sits in a very wide column.** → That is the
  pre-merge behaviour the shell was designed around, and the rails bound the column. If it turns out
  to read badly, the answer is a decision with an entry behind it, which this change makes possible
  rather than forecloses.
