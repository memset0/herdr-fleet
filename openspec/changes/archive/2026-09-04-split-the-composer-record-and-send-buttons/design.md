## Context

See proposal.md — Why.

Three facts about the baseline shape the approach.

**The draft row has one trailing slot with four branches.** `web/src/components/composer.tsx` renders
a flex row of the field wrapper and exactly one control after it. That control is the override button,
or the destructive-input confirm button, or the microphone, or Send — chosen in that order, with the
microphone's turn gated on `micIsPrimary`, which is `stt !== null && !direct.active && input.trim() === ""`.

**Everything downstream of the entry point already supports turn-taking.** The transcript is spliced
at the caret; hands-free withdraws itself when the draft is non-empty and falls back to inserting; the
recorder's `enabled` reads the capability, the composer lock and direct-typing mode but never the
draft's contents, so a clip survives the operator typing during it; and `/api/stt` is a stateless
one-shot with a concurrency admission and no per-session state. Nothing here needs to change.

**The file is upstream-owned and already attributed.** `FORK.toml` declares
`web/src/components/composer.tsx#displayPrefsAfterTextSize` under `native-manual-pane-fit-port`, and
`scripts/check-fork.ts` rejects a path declared by more than one invasive entry, so this port cannot
be given an entry of its own for that file. Two further upstream paths this change touches —
`web/src/components/composer-stt.test.tsx` and `docs/voice-and-push.md` — are not declared anywhere
yet and would fail the check as unclassified.

## Goals / Non-Goals

**Goals:**

- One entry point for the microphone that does not depend on what the draft holds.
- No new state, no new store, no new setting, and no change to the recorder's lifecycle.
- A fork boundary a reader can follow: the manifest says which port each upstream edit opens and why
  this one reverses an upstream decision.

**Non-Goals:**

- Restoring the pre-`abdbf45` in-field microphone. That layout is one way to reach the same
  requirement and is rejected below.
- A keyboard binding for recording. It is a coherent follow-up and is not in this change's specs.
- Changing when hands-free applies.

## Decisions

### The microphone becomes a sibling of the trailing slot, not a fifth branch of it

The row gains a second control between the field wrapper and the existing trailing slot. `micIsPrimary`
is deleted; the trailing slot keeps its remaining three branches and its last one is now unconditional.

*Alternative considered: restore the in-field microphone* — the pre-`abdbf45` layout, tucked beside the
attach button inside the field at `right-10`, with the textarea's reserved strip widened from `pr-11`
to `pr-20`. Rejected on two counts. It reserves its strip through a second `pr-*` in the same class
list, which tailwind-merge collapses to the last one — the hazard the comment at composer.tsx:1482-1489
exists to warn about — so the padding would have to become a computed single token, which is more
invasive to an upstream line than adding a sibling. And it makes the record control smaller and
visually subordinate to the attach control, when the requirement is that it rank beside Send.

*Alternative considered: keep one slot and make the microphone reachable another way* (a long-press on
Send, a keyboard binding, a bare Right-Alt toggle). Rejected: the operator this is for is holding a
phone, where a long-press is undiscoverable and a keyboard does not exist. A bare modifier toggle is
additionally not expressible in this fork's binding grammar, which matches on a physical key plus a
modifier set and whose recognizer ignores a modifier's own keydown by design.

### The microphone is drawn on the capability alone, in every branch

Its condition is exactly the one that decides the feature exists — a bridge-published provider and a
browser that can record, the single predicate `lib/stt.ts` already exposes. It is therefore present
while the destructive-input confirm and the override are armed too.

*Alternative considered: hide it while a confirm is armed*, to give the wide "Really send?" and "Type
anyway" buttons the row's width. Rejected: the field is the flexible child and those buttons do not
shrink, so the words already get their natural width without taking it from the microphone; and a
control that appears and disappears with a confirm state is a control the operator cannot count on
finding. One condition is also one condition's worth of test surface.

### Sending is refused by the control, not only by `send()`

`send()` already returns `false` for a blank draft, and the two confirm branches already disable
themselves on one. The plain Send branch does not, because until now the microphone stood in front of
it whenever the draft was empty and a provider existed. Both refusals — blank draft, live clip — are
therefore expressed on the control:

```
locked || sending || (!direct.active && (!input.trim() || recorder.busy))
```

The `!direct.active` guard is load-bearing. In direct-typing mode the same control ends that mode
rather than sending, it must stay activatable, and the field is showing `direct.value` rather than
`input`, so testing `input` there would be testing the wrong string. The recorder is suspended in
direct-typing mode and its clip discarded, so `recorder.busy` cannot be true there; the guard is for
the blank-draft half and costs nothing to apply to both.

The keyboard's send path takes the same refusal at its own call site, because a disabled button does
not disable a key binding.

### The manifest gains one new entry and one widened reason

`composer.tsx` stays attributed to `native-manual-pane-fit-port`, whose reason already carries four
capabilities' ports for exactly this rule and gains a fifth naming this one. The two newly-touched
upstream paths get a new `composer-voice-rank-port` entry with its own intent, reason and `verify`
list. Total invasive paths spent: three, which is the minimum the requirement can be met with — the
component that draws the row, the suite that pins its behavior, and the document that describes it.

### The field pays the width, knowingly

A second `size-11` control plus the row's `gap-3` takes 56px from the field's box. Against the
measurements recorded at composer.tsx:1482-1489, the 390px-wide case's typing area goes from 254px to
198px and the 320px case's from 184px to 128px. This is the cost `abdbf45` declined to pay. It is paid
here because the trade it declined was a trade about *one* dictation per message, and the operator
this fork serves dictates in turns.

## Risks / Trade-offs

- **The next upstream sync conflicts here, and silently agrees with upstream if resolved carelessly.**
  → The manifest entry's reason states the reversal in words, and `review = "every-upstream-sync"` puts
  it in front of whoever does the sync. The suite pins the two-control row, so a resolution that
  restores the shared slot fails rather than passes.
- **A narrower phone loses more of the typing area than the measurement above suggests.** → The number
  is recorded in the design and at the call site rather than left to be rediscovered; if it proves
  wrong in use, the in-field alternative above is the documented fallback and its cost is 36px rather
  than 56px.
- **Send disabled on a blank draft makes the post-send confirmation tick render dimmed**, because the
  draft is cleared by the send that produced it. → Accepted: nothing can be sent at that moment, and a
  control that says so is not wrong. Called out here so it reads as a decision rather than a defect.
- **Hands-free stops applying from the second clip of a draft onward.** → This is existing behavior and
  it is the correct one: a transcript merged onto words the operator typed is a sentence nobody has
  read, and sending it would send it unread. Stated in the specs as a non-goal rather than changed.

## Migration Plan

None. The change is confined to the web bundle, carries no persisted state, and adds no configuration.
Rollback is the revert of its commit, and the release that carries it is a PATCH on this product's
axis: the lead alone redeploys and every viewer has the previous bundle back as soon as it is levelled.
