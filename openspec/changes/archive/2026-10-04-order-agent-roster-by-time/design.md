## Context

See proposal.md. Collie v1.15.0 triage classifies without sorting. Four Fleet consumers already share the fork-owned roster; its adapter currently carries last-seen but not last-active timestamps.

## Goals / Non-Goals

**Goals:** Own stable timestamp ordering in one roster after removing pinned rows from buckets.

**Non-Goals:** Change bucket classification, native pin order, dashboard placement, timestamps, or visual rows.

## Decisions

Add optional `lastActiveAt` to the structural roster entry and copy it in the web adapter. Sort Recent by lastSeenAt and Ready/Working by lastActiveAt using copied arrays and stable sorting. Explicit undefined checks put missing times after every present time, including zero. Needs and Pinned retain input order. The shell section keeps its existing last-seen behavior.

Sorting at the rail alone would make ordinal and cycle commands disagree; sorting Collie's triage would change unrelated upstream surfaces. Both alternatives are rejected. All four implementation paths are already fork-owned in FORK.toml; there are no invasive paths or boundary additions.

## Risks / Trade-offs

[Rows can move when timestamps update] → This is the selected time-order behavior; stable ties and unchanged Pinned order limit movement.

[Concurrent changes share this capability] → Their distinct requirements can sync independently; this change owns only Agent rail reuses native Agent behavior.

## Migration Plan

Patch-axis frontend change: rebuild and deploy the lead bundle. Peers execute no changed code and need no redeploy. Roll back by restoring the prior bundle; no storage or wire migration exists.
