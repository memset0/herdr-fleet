## Context

See proposal.md. Upstream retains a transparent pb-1 wrapper for its retired folder-tab gap; native TabStrip itself is painted chrome. The wrapper's last 4px therefore expose page background.

## Goals / Non-Goals

Paint that outer padding and balance it without touching scroller negative margins, tap-floor pseudo-elements or fold logic.

## Decisions

Expose two optional CSS variables on the existing upstream wrapper: ground (transparent by default) and top inset (zero by default). The owned shell supplies chrome ground and 4px top inset, matching retained pb-1. This preserves the bare upstream render and keeps fork styling in the owned shell. Update native-manual-pane-fit-port's existing agent-chat attribution with a stable anchor and scoped browser verification; no new invasive path is needed.

## Risks / Trade-offs

An extra 4px of band height reduces mirror space → verify rendered geometry and unchanged tab activation. Revisit and remove this temporary port when an upstream layout correction supersedes it.

## Migration Plan

Lead-only PATCH with the concurrent Agent layout fix. No state migration or peer rollout.
