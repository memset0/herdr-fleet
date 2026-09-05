## Context

Collie has no command palette, so nothing here departs from upstream. The catalog is fork-owned and
its English names have no consumer outside the fork: they are displayed in the palette, in the
settings reference and in the floating acknowledgement, and are stored nowhere.

## Goals / Non-Goals

**Goals**

- The resize command is findable by the word an operator uses for it.
- The rule that made it unfindable is written down, so the next name does not repeat it.

**Non-Goals**

- Renaming the id. Separate decision, separate risk — see below.
- A keyword or alias mechanism. A command that is named correctly does not need one, and building
  one to avoid renaming a badly-named command is the wrong order.
- Auditing every other name in the catalog. `Toggle Type Mode` and `Copy Fleet Pane Link` are
  candidates; neither has been reported, and renaming on suspicion spends the operator's memory of
  what things are called for nothing.

## Decisions

### The name changes and the id does not

They are different kinds of string with different blast radii.

The NAME is display text. Nothing stores it, nothing parses it, and changing it costs three test
assertions.

The ID is the vocabulary of the settings document the operator writes by hand, and the parser rejects
a document WHOLE on an unknown id — so a rename would take every binding in that file down at once,
on every deployment whose document happened to name it, silently falling back to the shipped
defaults. The operator's current document does not name it, but each deployment has its own, and
"probably nobody wrote it" is not the standard for a change whose failure mode is that.

What the split costs is a palette row reading `Resize Pane` while the JSON beneath it says
`fit-pane-width`. That is a real papercut in the one place the two meet — the settings textarea — and
it is the reason renaming the id stays on the table rather than being ruled out. It is a decision to
take deliberately, after checking each deployment's document, not as a side effect of fixing a name.

### The naming rule goes in the spec, not in a comment

`Fit Current Pane Width` was not careless: it is an accurate description of what the code does. The
rule it broke is that a palette is searched in the operator's vocabulary, and that rule belongs where
the next name will be chosen — in the requirement that lists the names — rather than in a comment
beside the one row that got it wrong.

## Risks / Trade-offs

- **An operator who knew the old name loses it.** One person uses this palette and reported the
  problem; the cost is a search that finds nothing once.
- **The name and the id now disagree.** Stated above, accepted, and left as an open decision rather
  than pretended away.

## Migration Plan

None. Display text with no persisted form.

## Open Questions

- Whether to rename the id to `resize-pane` as well. It needs every deployment's settings document
  checked first, because an unknown id is a whole-document rejection.
