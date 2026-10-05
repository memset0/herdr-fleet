## Context

See proposal.md. Collie baseline is v1.15.0. Commit 6cc0bd36 changed the fork-owned right rail from xl (1280px) to 2xl (1536px), with an intermediate left-rail cap retaining a 66rem route. That rule now prevents ordinary desktop access to the right rail's Agents and Todoist.

## Goals / Non-Goals

Restore the shared 80rem threshold without changing stored widths, resize behavior, or mobile navigation. The existing upstream Pane switcher port must use the same threshold; no new manifest boundary is added.

## Decisions

Use xl for both rails and separators and 80rem for the Pane switcher media query, and remove the obsolete max-2xl hierarchy cap. At 1280px the default 280px/320px rails plus two 4px separators leave 672px for the route; maximum 420px/460px rails leave 392px. This remains usable at the existing phone column scale. Retaining the 66rem cap would create an unusably small hierarchy beside the restored right rail. A dynamic breakpoint based on saved widths would add state-dependent visibility and is unnecessary.

## Risks / Trade-offs

The route becomes narrower when both rails appear at 1280px; bounded sidebar widths guarantee 392px at the threshold. The operator can resize or temporarily collapse chrome using existing controls.

## Migration Plan

No preference migration. Ship the web bundle; rollback restores the previous classes. Focused shell tests verify paired visibility and separator classes; the existing Pane switcher port tests verify the entry stands down at 80rem. FORK.toml updates the existing port description; public-tree and fork-boundary checks cover these paths.
