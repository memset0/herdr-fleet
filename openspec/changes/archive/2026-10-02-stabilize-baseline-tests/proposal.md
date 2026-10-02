## Why

Full verification reveals two baseline problems: a corpus assertion trusts directory enumeration order, and a speech probe can lose its deadline after a completed phase removes the timeout signal's final listener. The latter reproduces with real clocks as well as in the existing regression test.

## What Changes

- Sort corpus fixture names before comparing the exhaustive expected list.
- Keep the native speech timeout armed across sequential waits through a small fork-owned runtime compatibility helper; retain the unchanged upstream stalled-body regression.
- Add focused tests for listener gaps and preserve cancellation/reason semantics.
- Non-goals: changing timeout budgets, request identity, provider selection, dependencies or expected corpus contents; skipping tests.

## Capabilities

### New Capabilities
- `fleet-stt-deadline-compat`: Preserve whole-operation speech deadlines across completed phases on the supported runtime.

### Modified Capabilities
None.

## Impact

Baseline: Collie v1.15.0, commit `ef01b0ed4d9271897413984075aa6d2060ffcf2a`. New runtime behavior lives in a Fleet helper; `bridge/stt/provider.ts` imports it through one narrow port. One upstream corpus test is also corrected. The helper executes in bridges, so the combined release is MINOR, currently 3.6.0 to 3.7.0, with the lead deployed first and members requiring an update.
