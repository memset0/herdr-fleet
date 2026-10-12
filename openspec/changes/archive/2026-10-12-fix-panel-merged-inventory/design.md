## Context

Collie v1.20.1 snapshot responses are merged, including when a host is named. Widening selects a member’s sessions without making the response member-only. The panel treated the full response as an additional member inventory.

## Goals / Non-Goals

Fix owned inventory composition; keep native rail grouping and timestamps unchanged. No upstream ports, storage migrations or peer deployment.

## Decisions

Associate every successful widened response with its explicitly requested host and filter its rows before merging. Replace only that host’s lead rows, including an empty successful response. Preserve existing failed-member availability behavior. Deduplicate exact repeated scoped terminal placements, not display names; different placements with a shared stable reference remain ambiguous and cannot authorize navigation.

The six-dot handle has touch-action:none and captures its pointer immediately. Only the handle starts drag tracking; card bodies keep native scrolling and taps. Handle taps retain select-then-slot and keyboard assignment.

## Risks / Trade-offs

Synthetic member-only fixtures hid the merged-response contract → regression fixtures contain several hosts in every response, overlapping row ids, session metadata and distinct activity timestamps. Compare rendered panel counts and order with unique native rail input, and check live inventory counts without publishing runtime facts.

## Migration Plan

Frontend-only patch after verification. Rebuild the lead frontend; members and persisted assignments remain unchanged. Archive the completed change, publish on main and verify served build metadata.

## Verification and Release Assessment

35 focused inventory/panel/rail tests and seven Chromium scenarios passed. Browser coverage includes merged multi-member duplicates, sidebar timestamp order, immediate touch handle dragging, body scrolling and taps, assignment and synchronized selection. Read-only live normalization confirmed unique placements. Root/frontend typechecks, full-tree lint, privacy and fork audits passed. This frontend-only scope is PATCH, 3.16.0 → 3.16.1, requiring only a lead frontend rebuild. Archive before the functional commit, then publish the separate release and annotated tag on main.
