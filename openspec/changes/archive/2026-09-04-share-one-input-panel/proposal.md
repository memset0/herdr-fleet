## Why

Two keyboard surfaces now ask the operator for one line of text — the rename input and the close
confirmation — and each carries its own copy of the same structure: the panel, the heading, the
focused-and-selected field, the Enter/Escape handling and the reserved footer line. They were written
days apart and already differ in small ways nobody chose.

Two places is where a pattern gets promoted, and a third is coming: every question the keyboard asks
should look and behave like the same question.

The confirmation also puts its `y/N` in front of the field, where it reads as part of what you are
typing. It belongs in the heading, with the question it qualifies.

## What Changes

- One fork-owned prompt panel owns the shared behaviour: the panel shell, the heading and its detail
  line, an input focused with its initial value selected, submit on Enter, cancel on Escape and on
  dismissal, and one reserved line for a hint or a refusal that never resizes the panel.
- The rename input and the close confirmation become callers of it. Each keeps only what is its own:
  what a submission means, and what a blank value means.
- `y/N` moves into the heading, beside the question.

### Non-goals

- Changing what either surface does on submit, or either one's rules about a blank value.
- A general dialog framework, or moving anything into `components/ui/` — that directory is Collie's,
  and this shell serves the fork's own surfaces.
- Touching the row-actions surface, which is the pointer's and confirms in its own way.

## Capabilities

### Modified Capabilities

- `fleet-keyboard-commands`: every question the keyboard asks is one surface, and the confirmation's
  default answer is named in the heading rather than beside the field.

## Impact

- One new fork-owned component; the rename and confirm dialogs lose their duplicated structure.
- No change to the endpoints, the catalog, the recognizer, or any upstream-owned path.
