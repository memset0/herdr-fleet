## 1. Ground

- [x] 1.1 Verify hooks are installed, `main` equals `origin/main`, and record `bun run test:fork` (1040 owned, 74 invasive)
- [x] 1.2 Commit the planning artifacts alone (explicit paths); verify `openspec validate adopt-collie-1-23-3 --strict` and a clean tree

## 2. Preflight and merge

- [x] 2.1 Run `bun scripts/check-fork.ts --target v1.23.3` before this change exists; verify tag object `d20a39f2…`, commit `5bb4233b…`, 23 disturbed / 8 untouched, no owned path occupied
- [x] 2.2 `git merge --no-ff --no-commit 'v1.23.3^{commit}'`; verify `MERGE_HEAD` is `5bb4233b07cbfed2239fcfd7fe013323b55ac49c`
- [x] 2.3 Resolve the contract paths (`CLAUDE.md` symlink, `CHANGELOG.md`, version files at 3.22.0, `herdr-plugin.toml`, `COLLIE_CHANGELOG.md` prefix, `release.yml` trigger); `check-version.sh` prints ✓
- [x] 2.4 Resolve every code conflict and record each in the design; no conflict marker remains; `bun install` checked for lockfile changes
- [x] 2.5 Commit the merge with `git commit -F`; verify its second parent is `5bb4233b…`

## 3. Send ports on upstream's send rules

- [x] 3.1 Confirm every send port is present after the merge (bounds, cleanup, sweep, key token, Enter steers, hold switch, notice hint, phone budgets)
- [x] 3.2 Add a fork case for a Codex text that meets a turn started while typed (Enter), and a command (upstream's rule)
- [x] 3.3 Protocol, key-gate, send-patience, enter-steers, send-holds, profile-tunes, profile, guard and reply-action suites pass

## 4. Skill sync, walky talky, Bun floor, release lines

- [x] 4.1 `fleet/skill-sync.ts` with its fork-owned suite; one import and one call in `cli/update.ts`; new invasive entry; upstream's update suite passes unchanged
- [x] 4.2 Walky talky: Gateway passes the walky routes and refuses `/crew/`; fake-network handlers and Fleet route suites pass
- [x] 4.3 Bun floor 1.4.4 in `fleet/README.md`; `release.yml` stays on `workflow_dispatch`; `check-tag` suite passes

## 5. Review every entry and record the boundary

- [x] 5.1 Set `[upstream]` to `v1.23.3`; review every invasive entry with its verify list; record the decisions in the design
- [x] 5.2 Advance `reviewed = "v1.23.3"`; add the `UPSTREAM.md` row; record check-fork counts before and after
- [x] 5.3 Both typechecks, lint, `test:fork`, `test:fleet`, `check-private-facts`, focused suites; commit with explicit pathspecs and Unreleased lines

## 6. Archive

- [x] 6.1 Sync specs, validate, archive and commit locally; the release, the full suites on a member and the levelling are the owner's

## Phase record

- 2.2–2.5 Merge `88e53b57`, second parent `5bb4233b07cbfed2239fcfd7fe013323b55ac49c`; fifteen
  conflicts, recorded in the design; no lockfile moved.
- 3.2 `bridge/surface/protocol.test.ts` gains the Codex S1 case under the `fleet-enter-steers`
  describe; with upstream's Tab profile the same case takes Tab, so it pins the port.
- 5.3 Run on the development host, Bun 1.4.2 (below the new floor, upstream's preflight says amber;
  the full suites on Bun 1.4.4 are the owner's, on a designated member): both typechecks, full lint,
  `test:fork` (1048 owned / 75 invasive), `test:fleet` 753 / 0, every bun verify file of every entry
  (1136 / 0), the send, crew and update suites (802 / 0 and 381 / 0), `check-tag`, `pre-commit` and
  `check-version`, and the web verify files of every entry (54 files, 1756 / 2) plus the conflicted
  files' suites (all pass). The two web failures are this host's load: `table-run`'s corpus case
  timed out at 5 s and passes alone; the playground's every-card case also fails on untouched
  `v1.23.3` here (it and a second playground case time out). The
  privacy guard ran without a `LOCAL.md` here, so shapeless names were not checked.
