## Context

See proposal.md for scope. Current product release is 3.24.3. The selected upstream release is v1.28.0, with its tag dereferencing to `b178eb63f2255637f6326bb942a2505e2004c31f`. Adoption preflight fails because the actual common ancestor is v1.23.1, while the adopted provenance is v1.23.3 on a parallel release line. This is a deliberate stop, not a reason to relabel the old baseline.

The current runtime already has a direct control entrypoint, but local attachment and fit use a TUI snapshot and TUI command. The new upstream Core adapter is reusable; Fleet's terminal layer and durable bindings still need their own integration. Existing active terminal and navigation changes are preserved and are not archived by this work.

## Goals / Non-Goals

**Goals:** adopt an exact upstream release with truthful ancestry; drive the Core used by App; keep Fleet's authentication, terminal access and slow-screen behavior; prove migration on a selected deployment before calling it complete.

**Non-Goals:** recreate Collie's Core adapter, modify upstream ADRs, move operator state into source, start agents for testing, install desktop applications or remove existing TUI sessions. Deployment selection and credentials do not enter this public tree.

## Decisions

### 1. Audit the parallel upstream release lines before touching the merge

Keep the recorded v1.23.3 provenance. Add a narrowly bound reconciliation input to the preflight only after explicit approval of that policy change. It records the adopted commit, target commit and actual common ancestor, requires the adopted commit to be an ancestor of HEAD, and inventories `common..adopted` with patch-equivalence checks and a disposition for each non-equivalent change. Ordinary mismatches remain refusals. Test correct, stale, unrelated and unapproved acknowledgements.

The adoption remains a merge with the selected upstream release as its second parent. Compare both release lines rather than pretending all differences are downstream edits. Never change the baseline to v1.23.1 merely to satisfy the old guard. A preliminary adoption of v1.23.4 does not solve this: its relationship to v1.28.0 has the same earlier common ancestor.

### 2. Reuse upstream fixes without reducing slow-response tolerance

Confirmed upstream changes include post-record token minting (`2efc568cc`), excluding probe writes from read budgets (`983dc7859`), incomplete Core screen refusal (`46abf1d97`), late-probe waiting (`55da7259b`) and a fresh-S0 retry after a delayed repaint (`779c4c54c`). Keep those implementations and their existing coverage.

Upstream still has S0/probe/S1/S2 windows of 1200/900/2500/3000 ms, a 1200 ms card-settle bound and a 15000 ms forwarded pane-write bound. Current Fleet uses 3000/8000/15000/15000 ms, a 5000 ms card-settle bound, and 50000/60000 ms forwarding/request bounds. Port the patience policy through the smallest owned constants/hooks that still work with the new protocol, cap polling gaps and finish on decisive evidence. Recompute a complete request budget including added late-probe windows, permitted retries, cleanup and actual write costs; do not merely transplant the old constants. Preserve immediate refusal rather than silently queuing a send.

Drop the longer token-lifetime port only if the post-record mint eliminates its purpose under focused slow-disk and scheduler tests. Do not remove residue cleanup until upstream equivalents cover its delayed-arrival cases. Retain all stale-surface and draft guards. No speculative automatic resend after an uncertain outcome.

### 3. One selected Core endpoint for every local surface

Use validated deployment configuration to select Core mode, with one endpoint resolver shared by the Collie child, terminal resolution and manual fit. Keep backend-specific code under `fleet/`; the upstream Core adapter retains its implementation. The standalone control path must work with no `herdr` executable and must not invoke plugin actions. Fleet never owns the Core server lifecycle.

Resolve local pane addresses with the native Core client, verify live state and reject remote addresses. Attach the terminal through the native Core attach command (its CLI is `attach <terminal>`, not the TUI's `terminal attach --takeover`), retaining the existing ttyd/Gateway transport and browser exclusivity. Preserve endpoint selection in the spawned environment; requests do not choose executable arguments or sockets. Manual fit uses a retained native attachment/connection with current row geometry; test against an isolated real Core before accepting its ownership/geometry semantics.

Bind associations to the permanent Core id returned by hello and its local terminal address. Each selected Core server owns one session; hashing its permanent identity supplies the association session scope without coupling identity to a client alias or socket path. Hash opaque references through owned binding utilities. Never convert old TUI references by matching an address or label. Identity, resize and attachment changes remain in owned modules; introduce an upstream port only where the current generic snapshot cannot carry the necessary identity, and record it in FORK.toml with a focused verification.

### 4. Review and shrink the fork boundary deliberately

For each invasive entry, record keep/adapt/replace/drop and run its declared verification before advancing its reviewed release. Retain upstream's independent TUI implementation. Remove superseded Fleet send hooks and TUI-only runtime assumptions wherever the Core path renders them unnecessary; do not keep a second implementation of upstream recovery. Preserve an explicitly supported legacy entrypoint only where the compatibility contract requires it, with tests proving Core mode never depends on it. The major-change simplification review must list actual removals or explain each retained path.

Upstream ADRs remain its text. Preserve the adopted upstream changelog as a verbatim prefix and retain dropped history below the established marker. Public examples use reserved documentation values only.

## Risks / Trade-offs

- Parallel upstream lines can hide fixes absent from the target → record every adopted-line change, including patch-equivalent and superseded changes, before merge.
- New send recovery paths enlarge total latency → test the complete nested deadline hierarchy, late reads, slow writes and uncertain outcomes; callers must outlast the operation they await.
- Core supports multiple viewers with geometry semantics different from TUI takeover → exercise attachment and manual fit on an isolated Core before touching a live deployment; unsupported behavior is a migration blocker, not a reason to disable the feature silently.
- Existing active changes may overlap the upstream ports → report overlap and preserve their artifacts and behavior; do not mark their remaining acceptance tasks complete.
- Changed lifecycle/configuration is a major operator migration → prepare implementation and exact migration guidance, and publish 4.0.0 only under the owner’s explicit release authorization.

## Migration Plan

1. Complete the explicit release-line policy approval and audited preflight prerequisites, then checkpoint reviewed planning and policy changes so preflight sees a clean tree.
2. Preflight the exact release with the owner's already granted active-change authorization; review all owned-path collisions before merging.
3. Implement the real ancestry merge, port audit and Core runtime integration; run both typechecks, lint, root/web/Fleet tests, fork/private-fact/version gates and focused isolated-Core acceptance.
4. Prepare public major-migration instructions and keep deployment-specific inputs outside this tree. Snapshot the selected deployment's configuration and state, verify its existing Core, then switch only Fleet to the validated candidate. Obtain any separately required service or interruption authorization before that operation.
5. Verify authenticated browser access, Core terminal inventory, send/read behavior, terminal attach/fit/exclusivity and process continuity. Restore the prior Fleet generation on failure.
6. The owner explicitly authorized publication of 4.0.0 in this session. Publish the adoption only after all required source/release gates, and report source, release and actual deployment status separately. Archive only when the change's full acceptance scope has passed.

## Todoist retirement

The owner explicitly selected removal in the same 4.0.0 release. Delete the owned Todoist service, OAuth/callback/API routes, sidebar/settings/task-send UI, translations and dedicated tests/assets. Remove only its fork entries and narrow ports; retain shared bindings, favorites and tags. Existing external tasks, credentials and association files remain operator-owned and are not deleted or revoked. Inventory every live source reference and pass both typechecks plus boundary checks after removal. This is the major-change simplification review’s largest removal.

## Upstream adoption details

Upstream’s anonymous install ping defaults on in 1.28. Fleet preserves its existing no-egress rule through its owned child environment (`COLLIE_TELEMETRY=false`), without editing upstream telemetry code. Upstream Web profile fixtures select their original profiles through an owned test setup; Fleet UI fixtures opt in through the existing Fleet build flag. The manual-fit extension is inactive outside a Fleet build, avoiding an extra state update during native handover animations.

Both HTTP listeners explicitly outlast the browser send deadline (130 s HTTP > 120 s browser > 110 s forward > 90 s maximum execution). Bun’s default HTTP idle bound is 10 s, so changing only the protocol and callers would still abandon a quiet send. The bridge receives one owned constant at its listener; the Gateway is fully owned. Existing route and upload/body gates remain unchanged.

The bulk adoption also exposed a pipefail/early-grep race in staged-path guards. Here-strings preserve their existing predicates while avoiding a producer SIGPIPE on thousands of staged paths; protocol and changelog guards remain enabled.
