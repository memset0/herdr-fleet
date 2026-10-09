## 1. Ground

- [x] 1.1 Verify hooks are installed, `main` equals `origin/main`, and record `bun run test:fork` (21 pass; 871 owned, 94 invasive)
- [x] 1.2 Commit the planning artifacts alone (explicit paths); verify `openspec validate adopt-collie-1-18-0 --strict` and a clean tree

## 2. Preflight and merge

- [x] 2.1 Run `bun scripts/check-fork.ts --target v1.18.0 --allow-active-changes`; verify tag object `990260b8…`, commit `2ab62eaa…`, 19 disturbed / 11 untouched, no owned path occupied, this change listed
- [x] 2.2 `git merge --no-ff --no-commit 'v1.18.0^{commit}'`; verify `MERGE_HEAD` is `2ab62eaac43c8971fc698f81a2465d3059fce938`
- [x] 2.3 Resolve the contract paths (`CLAUDE.md` symlink, `CHANGELOG.md`, version files at 3.12.0, `herdr-plugin.toml`, `COLLIE_CHANGELOG.md` prefix); `check-version.sh` prints ✓
- [x] 2.4 Resolve every code conflict and record it in design decision 2; no conflict marker remains; `bun install` changes neither lockfile
- [x] 2.5 Commit the merge with `git commit -F`; verify its second parent is `2ab62eaa…`

## 3. Pairing (plan A)

- [x] 3.1 Add `fleet/collie-pairing.ts` with focused tests (fresh enrolment, replacement of a stale device, conflict refusal, unreadable registry, revoke)
- [x] 3.2 Enrol on a lead in `fleet/daemon.ts` before the children, hand the token to the Gateway only, revoke on a clean stop; readiness probes `/api/health`
- [x] 3.3 Inject the bearer in `fleet/proxy.ts`; refuse pairing and revocation writes in `fleet/gateway.ts` with a non-wipe body; cases in `fleet/proxy.test.ts` and `fleet/gateway.test.ts`
- [x] 3.4 Verify the restart path: a Collie child restart keeps the registry entry; a peer enrols nothing

## 4. Simplifications

- [x] 4.1 B1: `web/src/lib/fleet-i18n/` with `ft()`/`useFleetLocale()`; move every fork key out of upstream's dictionaries; switch fork call sites; record any key that must stay
- [x] 4.2 B2: drop fork-owned duplicates from `native-navigation-sidebars-port`
- [x] 4.3 B3: Gateway appends the font origin to the proxied CSP; `bridge/server.ts` back to upstream; focused case
- [x] 4.4 B4: fork lint files in their own override block
- [x] 4.5 B5: prove upstream's STT deadline on Bun 1.4.0; drop `stt-deadline-runtime-port` or keep it at a 1.4.2 floor; update `docs/herdr-fleet.md`
- [x] 4.6 B6: network-first navigation with precached-shell fallback on network failure only; focused worker cases

## 5. Overlaps

- [x] 5.1 Dashboard control bar beside the rails; rails tests pass
- [x] 5.2 Mic+send split mirrored with the left-hand layout; composer suites pass
- [x] 5.3 Disconnect badge visible on the Pane route; header suites pass
- [x] 5.4 Record the redaction bypass of the terminal surface (design decision 8)

## 6. Review every entry and record the boundary

- [x] 6.1 Set `[upstream]` to `v1.18.0`; review every invasive entry (keep, adapt, replace, drop) with its verify list; record the decisions table in the design
- [x] 6.2 Advance `reviewed = "v1.18.0"`; add the `UPSTREAM.md` row; record check-fork counts before and after
- [x] 6.3 Both typechecks, lint, build, `test:fork`, `check-private-facts`, focused suites; commit with explicit pathspecs and Unreleased lines

## 7. Verify on the designated member

- [x] 7.1 Push `main` unreleased (`SKIP_TESTS=1`); run the full suites against that commit on the designated member; classify every failure

## 8. Release and level

- [x] 8.1 Read the remote's newest tag; cut `chore(release): 3.13.0`; annotated tag `v3.13.0`, pushed by name
- [x] 8.2 Level the lead, then each member; verify census, the Gateway path, pairing refusal, the registry and a throwaway terminal

## 9. Archive

- [ ] 9.1 Sync specs, validate, archive, commit and push

## Phase record (2026-10-09)

- 7.1 `c93774d9` pushed unreleased. Full suites on the designated member at that commit, Bun 1.4.2:
  both typechecks, full lint, `test:fork`, cli 1932 / 0, scripts 281 / 0, fleet 716 / 0, bridge file by
  file 164 files 5040 / 0 (none hung), `test:crew` 66 / 0, every shell suite, web vitest 388 files
  20125 pass / 32 expected fail / 45 todo / 0 fail, build. No failure to classify. Upstream's Files-view
  failures recorded at the previous adoption on Bun 1.3.14 do not occur on 1.4.2. Browser tier not run.
- 8.1 `chore(release): 3.13.0` is `9abe5780`, annotated tag `v3.13.0` pushed by name; no GitHub Release.
- 8.2 Lead, the designated member and the personal-computer member all report `3.13.0+9abe5780` and
  `reachable` in the lead's census; the fourth member was not touched and stays unreachable. Through the
  public Gateway with a temporary session (revoked by logout afterwards, `401` after): the snapshot answers
  `200`; replies to throwaway shells on the lead and the designated member land; federated pane reads of
  both members answer; `POST /api/pair` and `POST /api/devices/revoke` answer `403` with the Gateway's own
  body; the registry's only label is `fleet-gateway`; only the Gateway child's environment holds the token;
  the proxied document policy carries the font origin in `style-src` and `font-src` only. On a throwaway
  member pane, Resize answered `100×40` and a terminal attach opened, streamed and accepted input. The
  throwaway workspaces were closed. The lead's deployment controller (private repository) reported a
  readiness failure, because it still expects Collie's `/api/config` to answer `200` without a token;
  the runtime itself was healthy.
