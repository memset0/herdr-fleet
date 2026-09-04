## Context

`useHostReading` in the Host row degrades, and says "unreachable", on `!writable || state !== "live"`.
`hostHealth` sets `writable` from the lead's own boolean, unsmoothed, and derives `state` by comparing
the receipt's age to `min(3 × pollMs, 15s)`. The two answer different questions, and only the first is
about the machine.

## Goals / Non-Goals

**Goals:** the row stops claiming a machine is down when the lead is merely between sweeps.

**Non-Goals:** any change to `hostHealth`, the tolerance, the lead's cadence, or a write gate; and no
last-seen text on the row, which would flap on the same clock.

## Decisions

### Split the union the row was reading

The row asked one question of two facts. It now asks them separately: incompatible and not-writable
say "unreachable" and take the refusal styling; a stale receipt takes neither. That is exactly the
shape Collie's own chip settled on after the same regression, so the two surfaces now agree.

Alternatives rejected:

- Keep the union and widen the tolerance until it stops flapping: the tolerance is upstream's and is
  correct for what it measures; the row's sentence was the wrong one regardless of its threshold.
- Say "last seen …" on a stale row: the same clock, so the same flap, with a longer sentence.
- Grey the row without the word: a tint the operator cannot name is a state they cannot act on, and
  the whole point is that there is nothing to act on.

## Risks / Trade-offs

- **[A genuinely down member reads normal for one tolerance window]** → unchanged from before: the
  lead's own boolean is what flips, and it is not smoothed.

## Migration Plan

Presentation only. Roll back by redeploying the previous commit.
