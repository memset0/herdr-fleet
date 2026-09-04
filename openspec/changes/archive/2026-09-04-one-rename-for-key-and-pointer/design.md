## Context

See `proposal.md` — Why. Both renames call the same two client functions and keep the same rules; what
differs is only which component draws the field.

## Decisions

### Share the RENAME, not the input

The obvious move is to point the menu's dialog at the shared input panel and stop there. That would
leave two `save()` functions doing the same thing with the same endpoints — which is the half of this
duplication that can actually go wrong, because a rule changed in one is a rule that quietly differs
in the other.

So the menu mounts the rename component itself. One save, one set of rules, one set of messages, and
the input panel underneath it is shared as a consequence rather than as the goal.

### The centred dialog is deleted rather than kept

Its own header anticipated a third caller, which is a good instinct and is exactly why it should not
survive with none: the next surface that needs to ask for a line of text should find one answer to
that question, not two, and the one it finds should be the one every existing surface uses.

Deleting it also removes the last place in the fork where a question is asked in the middle of the
screen over its own scrim, so "where does this application ask things" now has a single answer.

## Risks / Trade-offs

- **The menu's heading changes** from the object's name to "Rename tab" / "Rename pane" → the name is
  in the field, selected, which is where the operator is looking; the heading now says what is about
  to happen, which is what the keyboard's route already said.
- **A blank Tab name used to be refused by a disabled button and is now refused in the panel** → the
  refusal is now stated rather than merely enforced, which is the better of the two.

## Migration Plan

None. Both routes keep their entry points and their effect.
