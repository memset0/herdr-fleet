## Why

Five fork-owned test files under `fleet/` create a temporary directory per run and never remove it. The directories accumulate in the system `tmpdir()` over many runs. The leakage is concentrated in five files: `fleet/config.test.ts` (1 dir / run), `fleet/gateway.test.ts` (7 dirs / run), `fleet/server.test.ts` (1 dir / run), `fleet/session-store.test.ts` (2 dirs / run), and `fleet/settings/gateway-settings.test.ts` (8 dirs / run). Each file already follows a sibling pattern elsewhere in the tree that removes what it makes — `fleet/main.test.ts` uses a module-level `roots[]` + `afterEach`, `fleet/pack-enrollment.test.ts` uses per-test `try/finally`, `fleet/protocol.test.ts` uses `try/finally` for both socket and dir…

## What Changes

- Make every fork-owned test that calls `mkdtemp` register the path in a file-local array (or use `try/finally` where the test body already runs to completion) and drain that array in a `bun:test` `afterAll` (or `afterEach`, matching the closest sibling) so the directory is removed when the test exits, including its failure paths.
- The Gateway test, the Gateway-settings test, and the session-store test gain a `roots: string[]` and an `afterAll` that drains it with `rm(root, { recursive: true, force: true })`, mirroring `fleet/terminal/route.test.ts`.
- The Gateway-listener test (`fleet/server.test.ts`) extends its existing `try/finally` to also remove the temporary state dir next to the existing `server.stop(true)`.
- The config test wraps its single `mkdtemp` site in `try/finally` because the test has no helper and already runs assertions that may throw.
- A new requirement on `fleet-plugin-runtime` states that fork-owned tests MUST remove what they create, with two scenarios pinning the rule against the established pattern.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-plugin-runtime`: Fork-owned tests that allocate a temporary directory remove it before the test process exits, using a `bun:test` lifecycle hook or per-test `try/finally` matching the closest sibling pattern.

## Impact

The exact upstream baseline remains Collie v1.5.2, tag object `38798351a64cae43c03f156c0b80f22f14d50565`, commit `cea2035e1f02d560d1bac66c85314828a7e01c20`. This change touches only test files and a single requirement in `fleet-plugin-runtime`. No runtime, build, packaging, manifest, version, or configuration change. No production code under `fleet/`, `bridge/`, `cli/`, `web/`, `scripts/`, or `systemd/` is modified. No new dependency. The Gateway runtime's terminal-socket directory (`fleet/terminal/spawn.ts::makeSocketDirectory`) is not in scope — that is production code whose removal closure is held by `TerminalService.stop`.

Non-goals: terminal-session-acquisition work (a parallel change by another worker owns it), STT upstream test-runtime fixes, font code, peer-deployment scripts, package versions, release cuts, sweeping the existing accumulated temp directories, sweeping any prefix in `/tmp`, or installing a shared test fixture helper. Five leaking test files only; each fix is local.

The change alters no released artifact. Five test files clean up after themselves; that is a developer-experience fix, not a behavior change for any running deployment. No release is warranted; an Unreleased changelog line is not added here and is left to the release-cutter to coordinate against the in-flight terminal-session-acquisition change that owns the next Unreleased entry.
