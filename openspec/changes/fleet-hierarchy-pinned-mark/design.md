## Context

Collie's pins live in a module store (`web/src/lib/pins.ts`) read with `usePins()` and tested per
pane with `pinMatcher(list)(pane)`. The navigation shell already subscribes to it for the command
layer's roster. The hierarchy tree is derived in the shell by `deriveNavigationTree`, a pure,
React-free model in `fleet/ui/native-navigation/model.ts`, from `NavigationPaneInput`s built by
`toNavigationPane`. A merged single-Pane row is built by spreading the Pane's own row.

## Goals / Non-Goals

**Goals:** a pinned Pane's row (and a merged row whose Pane is pinned) is recognisable at a glance,
live, with no layout cost to the row's trailing facts.

**Non-Goals:** no pin state outside the browser, no new store, no change to the Agent rail.

## Decisions

1. **Derived in the shell, carried as model data.** The shell computes `pinMatcher(usePins())` and
   `toNavigationPane` sets `pinned: true` on each matching Pane input; `paneRow` copies it onto the
   row, so the merged-row branch inherits it through its existing spread. The tree component reads
   `row.pinned` only. Alternative — passing a predicate into the tree component — was rejected: the
   tree would need `AgentView`s it does not have, and the model test could not cover the merged row.
   The tree memo gains the matcher as an input, so a pin change re-derives the tree.
2. **The mark is bold + `ui/badge`.** `Badge variant="outline"` at the compact size other rails use
   (`px-1.5 py-0 text-[10px] font-medium text-muted-foreground`), the same compact outline badge `fleet-pane-fit.tsx` draws.
   The Badge is `shrink-0` and the title keeps `truncate`, so the title gives way first; the state
   dot keeps `ml-auto shrink-0`. The badge is 18px tall inside the 28px row, so the row's height does
   not change.
3. **Shift accounting (DESIGN.md §2).** Bold text and a badge appearing are a state that changes a
   box. They change only on pin or unpin, which is an act the operator just performed and is
   watching (§2's allowed class (a)); the row's height is unchanged and the trailing dot is anchored
   to the row's end, so no neighbour row or control moves. A poll never changes the mark.
4. **String.** `fleet.navigation.pinned` through `ft()`, lowercase "pinned" in English as requested.

## Risks / Trade-offs

- [A narrow rail with a long title] → the title truncates earlier on pinned rows; accepted, the
  badge is the information the operator asked for.
- [An upstream adoption changes `pinMatcher`] → the shell's one call follows it; the model is
  unaffected.
