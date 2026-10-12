# pi question screens: what the reader reads, and the evidence

Herdr reports stock pi and OmO (the Senpi engine) alike as `agent: "pi"`. pi's question tools are
extensions, and npm lists many. So `ask.ts` reads every one of them by shape and footer, and names
none (`.adr/0098`). This file holds the evidence for each rule: the captures, the source lines read,
and the live probes.

## The screens in the corpus

| Screen | Footer | Plan | Proof |
| --- | --- | --- | --- |
| stock `question` (pi 0.87.1, 1.1.0) | `↑↓ navigate • Enter to select • Esc to cancel` | (a) walk | `pi--v0871-question-*`, `pi--v110-question-*`; source below |
| stock `questionnaire`, one question | `↑↓ navigate • Enter select • Esc cancel` | (a) walk | `pi--v*-questionnaire-single*` |
| stock `questionnaire`, a tab page | `Tab/←→ navigate • ↑↓ select • Enter confirm • Esc cancel` | (a) walk, captioned | `pi--v*-questionnaire-tabs*` |
| stock `questionnaire`, Submit page | the same footer, `Press Enter to submit` in the body | review (Enter, Escape) | `pi--v*-questionnaire-submit-ready.txt` |
| PR 397 extension, single | `↑↓ navigate • Enter to select • Tab to add note • type a number or an answer • Esc to cancel` | (a) walk | `pi--v110-single*` |
| PR 397 extension, a tab page | `←→ tabs • ↑↓ navigate • Enter select • type a number or text • Esc cancel` | (a) walk, captioned | `pi--v110-tabs-single*`, `-tabs-compact` |
| PR 397 extension, Review page | `←→ tabs • Enter submit • Esc cancel` | review (Enter, Escape) | `pi--v110-review-complete.txt` |
| OmO ask, one question | `↑↓ move  1-9 select  space select  enter next  tab next question  c comment  esc cancel` | (b) digit | `pi--omo-v5130-single-described*`; probe below |

Raw, with the Escape card: every multi-select (`[ ]` rows, or a footer that gives Space a tick or a
toggle), a pointer on the free-text row, every inline answer editor (`Enter to submit • Esc to go
back`), an incomplete Submit or Review page (`Unanswered: …`, `Enter goes to the first unanswered`),
and pi's own `/model` picker (`pi--v110-core-selector.txt`).

A dialog quoted in agent prose or a tool result stays prose (`pi--prose-quoted-*`). The tail
decides: the bottom rule must have one to four styled status rows under it and nothing else, and
the footer row must be styled. With the editor below, the editor's own rules are the tail, so the
quoted block above it is never read. With no editor, a quoted block lifts only when every tail rule
holds, which is pi's own screen; a walked tap there still sends no Enter, because the pointer never
moves and the poll times out.

## Stock pi, read from its source

pi's own examples, `examples/extensions/question.ts` and `questionnaire.ts`, are the same in pi
0.87.1 and 1.1.0.

- `question.ts`: Up and Down move the pointer and clamp at both ends, over every row including the
  last one, `Type something.` (`Math.max(0, …)`, `Math.min(allOptions.length - 1, …)`). So the ends
  do not clamp at the last real option, and the reader sets no `clampedEnds`. Enter on an option
  answers and closes. Enter on `Type something.` opens an inline editor (`Your answer:`), and Escape
  there goes back to the list. Digits do nothing.
- `questionnaire.ts`: on a question page, Up and Down move and clamp, and Enter saves the pointed
  option and moves to the next tab (or to Submit after the last). Tab and Left/Right move between
  tabs and wrap. On the Submit tab, Enter submits only when every question has an answer. The
  current tab chip is drawn with a background colour only (`48;2;…`), so the reader finds it by
  that segment; answered chips are `■`.

## OmO, probed by the PR 412 author

Captured on 2026-10-12 with OmO 5.1.30 (Senpi 2026.10.11), Herdr 0.9.3, a 113-column sandbox tab.

| Action | Keys | Observed result |
| --- | --- | --- |
| Select Blue while the pointer is on Blue | `3` | Dialog closes; agent echoes `PROBE_ANSWER=Blue` |
| Move the pointer | `Down`, `Up` | Only the pointed option changes; all descriptions remain |
| Focus the Other row | `Down` to the last row | `→ Type your own answer...` |
| Open Other's editor | `Enter` on that row | `Your answer ...` and `> ` input; footer changes |
| Discard the empty Other editor | `Escape` | Returns to the question |
| Cancel an unanswered question | `Escape` | Tool reports `cancelled`; agent resumes |
| Cancel a multi-select question | `Escape` | Tool reports `cancelled`; agent resumes |

A choice sends its printed digit alone, never a trailing Enter. OmO's
`dist/modes/interactive/components/ask-user-question-keys.js` sends `1` to `9` to
`activateOption`, and for one question with `multiSelect: false` it submits at once. The `3` probe
confirmed it. Enter there means "next", so the footer gives no Enter plan, and plan (b) applies
only on one question: one question chip, and the `Submit (0/1 answered)` counter when it is there.

OmO's multi-select prints no checkbox. Its footer says `space toggle  enter toggle`, and Enter
toggles, so the footer alone keeps it raw (`pi--omo-v5130-multi.txt`).

OmO's title row counts down (`Ask user · 30m`). `coreSignature` blanks that clock and the pointer,
`signature` keeps both, so a tap on a screen whose clock moved is refused and the phone reads again.

**Probed live, 2026-10-12, by the PR 412 author** (OmO 5.1.30, Herdr 0.9.3, a paired headless
Chromium at the `iphone-14` preset). Chat drew the card with three option buttons and Cancel. With
the pointer on Red, a tap on Green answered `Color: Green`.

## The editor

Registering an adapter for `pi` moves every pi pane off the one-step send onto the guarded one
(`lib/reply-action.ts`), so `composer.ts` reads both editors: stock pi (0.85.1, 0.87.1, 1.1.0: a
rule, the draft at column zero, a rule, status rows) and OmO (a `❯` row and two-space continuations).
The slash palette, a labelled top rule and a pasted shorter rule come from the PR 397 captures and
the canary's `15-rule` message. `composerReady` is false whenever `piModalOnScreen` holds, so the
phone never types into a question's answer editor.

## Not covered

- The PR 397 extension is not published, so its screens are read from the contributor's captures
  only, and three of its walk groups have one capture each (`WALK_GAPS`).
- Multi-select on any pi screen. The only evidence for a Space-then-Enter recipe is the PR 397
  extension, and OmO's Enter toggles. It stays raw until a published extension proves the recipe.
- OmO with several questions, or with an answered question.
