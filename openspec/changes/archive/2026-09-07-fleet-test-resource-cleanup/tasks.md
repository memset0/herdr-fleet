## 1. Per-file cleanup of fork-owned test resources

- [x] 1.1 In `fleet/config.test.ts`, wrap the `mkdtemp(join(tmpdir(), "herdr-fleet-config-"))` site at line 551 in a `try/finally` that calls `await rm(root, { recursive: true, force: true })`. The four assertion arms of that test must each still observe the same throw / resolve behaviour.
- [x] 1.2 In `fleet/gateway.test.ts`, declare a module-level `const roots: string[] = []`, push the `root` from `setup()` into it, and add an `afterAll(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); })`. Import `afterAll` and `rm` from `bun:test` and `node:fs/promises` respectively.
- [x] 1.3 In `fleet/server.test.ts`, extend the existing `try/finally` block to also `await rm(state, { recursive: true, force: true })`. The removal is the second statement of the `finally` and runs whether `server.stop(true)` resolves or rejects, so a stop failure cannot skip the directory release. Use the minimal existing pattern (`try { … } finally { await server.stop(true); await rm(state, { recursive: true, force: true }); }`). The `state` directory is also removed if the body throws between `mkdtemp` and the `try` block.
- [x] 1.4 In `fleet/session-store.test.ts`, declare a module-level `const roots: string[] = []`, push the `root` after each of the two `mkdtemp` calls, and add an `afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); })`. Import `afterEach` and `rm` from `bun:test` and `node:fs/promises`.
- [x] 1.5 In `fleet/settings/gateway-settings.test.ts`, declare a module-level `const roots: string[] = []`, push the `root` from `setup()` into it, and add an `afterAll(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); })`. Import `afterAll` and `rm`.

## 2. Behavior proof under independent TMPDIR

Each `bun test` run uses a private `TMPDIR=/tmp/apply-<run>-<file>` directory created solely for that run. Use one TMPDIR per file; never reuse.

- [x] 2.1 Success path — all five files. For each of `fleet/config.test.ts`, `fleet/gateway.test.ts`, `fleet/server.test.ts`, `fleet/session-store.test.ts`, `fleet/settings/gateway-settings.test.ts`, run the focused file in its own TMPDIR and assert that the resulting TMPDIR contains zero `herdr-fleet-*` directories after the run returns. Capture the count and the test outcome.
- [x] 2.2 Failure path — at least one per distinct cleanup mode. Use the closest `toThrow` arm (or the closest setup-step throw) for the throwaway mismatch, run the file in an independent TMPDIR, assert zero leftover dirs, revert in the same step. Do not commit the swap.
  - Mode `try/finally` with no helper: `fleet/config.test.ts` (one of the four assertion arms, e.g. the `chmod 600` reject at line 556).
  - Mode `try/finally` with helper + setup-exception coverage: `fleet/server.test.ts` — verify both (a) an exception inside the test body before `startGateway` completes leaves no `state` dir, and (b) `server.stop(true)` rejecting does not skip `rm(state, …)` (the `finally` runs in order; capture the stop rejection and confirm the directory is removed before the test process exits).
  - Mode `afterAll` module-hook with `setup()` helper: `fleet/gateway.test.ts` (one of the `setup()`-driven tests; inject a failure after `setup()` returns).
  - Mode `afterEach` module-hook without helper: `fleet/session-store.test.ts` (one of the two `rejects.toThrow` arms).
  - Mode `afterAll` module-hook with `setup()` helper, settings route: `fleet/settings/gateway-settings.test.ts` — at least one focused failure inside a settings test, after `setup()` returned.
- [x] 2.3 Run `bun run typecheck` at the herdr-fleet root, `bun run lint` over the five edited files, and `bash scripts/check-version.sh`; report each result.

## 3. Spec alignment and delivery

- [x] 3.1 Re-read the planning artifacts (`proposal.md`, `design.md`, `tasks.md`, `specs/fleet-plugin-runtime/spec.md`) against the implemented code in each of the five files; ensure the rule added to `fleet-plugin-runtime` is the rule actually implemented (per-test cleanup using a `bun:test` hook or `try/finally`; no shared helper).
- [x] 3.2 Run `openspec validate fleet-test-resource-cleanup --strict --type change` and confirm the result is clean.
- [x] 3.3 Report the exact task-owned file list (the five `fleet/*.test.ts` plus the OpenSpec artifacts under `openspec/changes/fleet-test-resource-cleanup/` and `openspec/specs/fleet-plugin-runtime/spec.md`) and the proof from §2 to the coordinating reviewer. Do not modify `CHANGELOG.md`, `FORK.toml`, the version files, or the manifest. Do not sweep `/tmp` by prefix. Do not run the full test suite. Do not deploy or cut a release. The repo is shared with concurrent workers; compare only the exact task-owned paths, not the whole `git diff`. Do not stage, commit, archive, or push until the reviewer releases.
