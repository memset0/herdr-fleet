## Context

See proposal.md. Both problems reproduce with unchanged source. Directory-discovery failures seen alongside them disappear when the runner uses a temporary root outside an existing Git directory; those tests need no source edits.

## Goals / Non-Goals

Keep every existing assertion, timeout budget and error classification. Do not alter dependencies, credentials, request identities or peer wire contracts.

## Decisions

- Sort fixture filenames lexically before reading them. Changing the exhaustive expected list to match one filesystem would merely relocate the failure.
- The real-clock reproduction reaches body cancellation but never times out. A direct native timeout loses its timer when its final abort listener is removed between waits on the supported runtime. A signal linked with `AbortSignal.any([nativeTimeout])` remains armed: the same reproduction then returns a timeout after one request. Keep that linking rule in `fleet/stt-deadline.ts`, replacing only the native timeout construction in the upstream provider. The caller's cancellation and reason precedence stay in the existing implementation.
- Retain the original fake-clock body-disposal test unchanged and add focused compatibility coverage in Fleet. Replacing fake time with real time alone was rejected by the reproduction; it hides neither the runtime problem nor fixes it.
- Declare `bridge/stt/provider.ts` and `web/src/lib/table-run.test.ts` as narrow ports. A fork-owned module carries the runtime rule; the test's filename ordering cannot be changed from an owned wrapper without a wider test-runner interception.

## Risks / Trade-offs

- Runtime workaround lifetime → keep it explicit in the fork manifest and reconsider during upstream/runtime adoption.
- Abort reason identity and caller precedence → retain existing composition and verify the upstream provider suite unchanged.

## Migration Plan

No data or configuration migration is needed. Run focused reproductions and complete suites with an isolated temporary root, then validate and archive. The bridge change raises the combined release from a lead-only patch to a minor (3.6.0 to 3.7.0). Deploy the lead first; members need that minor to receive the runtime correction. The wire contract is unchanged during rollout.

## Verification status

The unchanged speech provider and Codex tests pass with the compatibility helper; focused coverage
also verifies listener gaps and caller precedence. The complete backend and frontend suites pass
on the designated runner with a local isolated temporary root, as do both typechecks, full lint,
the fork/privacy gates and the production build. No timeout budget or assertion was relaxed.
