## Context

Five fork-owned test files under `fleet/` allocate a temporary directory per run and never remove it. The five files and their call sites (verified against the current product commit on `origin/main`) are:

| File | `mkdtemp` site | Pattern to adopt |
|---|---|---|
| `fleet/config.test.ts` | `:551` inside `test("loads only a regular owner-only file without echoing a secret", ...)` | per-test `try/finally` (no helper; test body has 4 assertion arms that may throw) |
| `fleet/gateway.test.ts` | `:39` inside `async function setup()` | module-level `roots: string[]`, `setup()` pushes, `afterAll` drains |
| `fleet/server.test.ts` | `:14` inside the single test | extend the existing `try/finally` to `await rm(state, { recursive: true, force: true })` next to the existing `await server.stop(true)` |
| `fleet/session-store.test.ts` | `:13` and `:24`, two tests, no helper | module-level `roots: string[]`, each test pushes after `mkdtemp`, `afterEach` drains |
| `fleet/settings/gateway-settings.test.ts` | `:67` inside `async function setup()` | module-level `roots: string[]`, `setup()` pushes, `afterAll` drains |

Already-clean files in the handoff list — `fleet/main.test.ts`, `fleet/pack-enrollment.test.ts`, `fleet/protocol.test.ts`, `fleet/terminal/route.test.ts`, `fleet/terminal/spawn.test.ts` — are not modified. The upstream-bridge and CLI tests, which also call `mkdtemp` and clean up via `afterAll`/`try/finally`, are not modified.

The pattern adopted here is the one already in use elsewhere in the fork, not a new abstraction. `fleet/terminal/route.test.ts` keeps a `roots: string[]` populated by `setup()` and drained by `afterAll` with `for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true })`. `fleet/main.test.ts` keeps the same shape but drains on `afterEach` so a per-test failure does not contaminate the next test. Both are accepted shapes; the change picks one per file based on which sibling it already resembles.

`fleet/terminal/spawn.ts::makeSocketDirectory` is production code that returns `{ path, remove }` for the Gateway to call on `stop`. It is not a test, is not in scope, and is not modified.

## Goals / Non-Goals

**Goals:** the five leaking files clean up the directories they create, both on the success and the failure path of every test they run. The cleanup is local to each file — no shared helper, no abstraction. Each cleanup uses `node:fs/promises.rm` with `{ recursive: true, force: true }`, identical to the sibling pattern.

**Non-Goals:** no shared `mkdtemp` wrapper, no `tempDir()` utility, no centralized fixture helper. No edits to already-clean files. No edits to `fleet/terminal/**`, `bridge/**`, `cli/**`, `web/**`, `scripts/**`, `systemd/**`, `FORK.toml`, `CHANGELOG.md`, or version files. No sweeping of the existing accumulated temp directories, no prefix-based cleanup of `/tmp`, and no edits to a live deployment workspace.

## Decisions

### One file-local cleanup per leaking file

Each of the five files owns its own `roots` array (or extends an existing `finally` block, in the case of `fleet/server.test.ts`). The change does not introduce a shared fixture helper or a cross-file utility, because the existing convention in the fork is to repeat this small shape per file — that repetition is the readable form, and adding a helper would change the pattern across more files than this change touches.

#### Rejected alternatives

- A shared helper under `fleet/test-helpers.ts` would require editing every file that uses it, which is exactly the larger refactor this change rules out.
- A global `afterAll` registered via `bun --preload` would change test behavior across the whole tree, not just the five files.
- A prefix-based sweep at test-suite start would delete directories left by other agents, the live deployment, or a previous crashed run — all of which are out of scope.

### Pattern per file matches the closest sibling

- `fleet/gateway.test.ts` and `fleet/settings/gateway-settings.test.ts` both have a `setup()` helper that calls `mkdtemp` once per invocation. They adopt `roots: string[]` + `afterAll` drained with `splice(0)`, matching `fleet/terminal/route.test.ts`.
- `fleet/session-store.test.ts` has no helper and two independent tests. It adopts `roots: string[]` + `afterEach`, matching `fleet/main.test.ts`. Per-test cleanup keeps one test's failure from contaminating the next.
- `fleet/server.test.ts` has one test with a `try/finally` that already closes the gateway. The fix adds `await rm(state, …)` to that existing `finally` — the smallest possible change.
- `fleet/config.test.ts` has one test with four assertion arms, two of which `await expect(…).rejects.toThrow(…)`. `afterEach` or `afterAll` would only drain a single registered path; the test body is best wrapped in `try/finally` because each arm's path is the same `root`.

### Failure-path cleanup is part of the contract

Every cleanup mechanism chosen above runs on the failure path. `bun:test` `afterAll` runs when a test fails, and `try/finally` runs whether the body throws or returns. The change's acceptance gate verifies this by injecting a failure in each of the four tests that exercises a `rejects.toThrow` arm and asserting that the leaked directory count is still 0.

### Privacy
No LOCAL.md content is referenced or paraphrased. No device, domain, account, path, parent-tool name, or mesh name is added to any tracked file.



## Coordination

- `CHANGELOG.md` is shared with the in-flight `fix-terminal-session-acquisition` change (which plans to add its own Unreleased line). This change does not modify `CHANGELOG.md`. The release-cutter, not this change, decides whether a test-only cleanup warrants an Unreleased entry, and may batch it with the next functional change.
- `FORK.toml` already lists all five paths under `verify`. No entry is added or removed.
- No edits to a live deployment workspace. No `pkill`, no `killall`, no prefix sweep.

## Verification

Per-file independent-TMPDIR runs before and after the fix. The baseline counts (leaked `herdr-fleet-*` directories after a clean `bun test` in a fresh `TMPDIR`):

| File | Tests | Leaked before fix |
|---|---|---|
| `fleet/config.test.ts` | 19 | 1 |
| `fleet/gateway.test.ts` | 8 | 7 |
| `fleet/server.test.ts` | 1 | 1 |
| `fleet/session-store.test.ts` | 2 | 2 |
| `fleet/settings/gateway-settings.test.ts` | 8 | 8 |

Expected after fix: each row reports 0 leaked dirs in its independent TMPDIR. Failure-path verification injects a temporary `toThrow` mismatch per file with `await expect(…).rejects.toThrow(…)`, runs the file in its own TMPDIR, asserts 0 leftover dirs, then reverts the mismatch. The injection is throwaway — it is not committed and not captured in a permanent test.

`bash scripts/check-version.sh` continues to print `✓`. `bun run typecheck` at the herdr-fleet root passes. `bun run lint` over the five files passes. `openspec validate --change fleet-test-resource-cleanup --strict` passes. No `git reset`, `rebase`, `stash`, or `merge`. No worktree.
