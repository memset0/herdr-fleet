## 1. Ground

- [ ] 1.1 Verify hooks are installed, `main` equals `origin/main`, and record `bun run test:fork` (21 pass; 871 owned, 94 invasive)
- [ ] 1.2 Commit the planning artifacts alone (explicit paths); verify `openspec validate adopt-collie-1-18-0 --strict` and a clean tree

## 2. Preflight and merge

- [ ] 2.1 Run `bun scripts/check-fork.ts --target v1.18.0 --allow-active-changes`; verify tag object `990260b8…`, commit `2ab62eaa…`, 19 disturbed / 11 untouched, no owned path occupied, this change listed
- [ ] 2.2 `git merge --no-ff --no-commit 'v1.18.0^{commit}'`; verify `MERGE_HEAD` is `2ab62eaac43c8971fc698f81a2465d3059fce938`
- [ ] 2.3 Resolve the contract paths (`CLAUDE.md` symlink, `CHANGELOG.md`, version files at 3.12.0, `herdr-plugin.toml`, `COLLIE_CHANGELOG.md` prefix); `check-version.sh` prints ✓
- [ ] 2.4 Resolve every code conflict and record it in design decision 2; no conflict marker remains; `bun install` changes neither lockfile
- [ ] 2.5 Commit the merge with `git commit -F`; verify its second parent is `2ab62eaa…`

## 3. Pairing (plan A)

- [ ] 3.1 Add `fleet/collie-pairing.ts` with focused tests (fresh enrolment, replacement of a stale device, conflict refusal, unreadable registry, revoke)
- [ ] 3.2 Enrol on a lead in `fleet/daemon.ts` before the children, hand the token to the Gateway only, revoke on a clean stop; readiness probes `/api/health`
- [ ] 3.3 Inject the bearer in `fleet/proxy.ts`; refuse pairing and revocation writes in `fleet/gateway.ts` with a non-wipe body; cases in `fleet/proxy.test.ts` and `fleet/gateway.test.ts`
- [ ] 3.4 Verify the restart path: a Collie child restart keeps the registry entry; a peer enrols nothing

## 4. Simplifications

- [ ] 4.1 B1: `web/src/lib/fleet-i18n.ts` with `ft()`/`useFleetLocale()`; move every fork key out of upstream's dictionaries; switch fork call sites; record any key that must stay
- [ ] 4.2 B2: drop fork-owned duplicates from `native-navigation-sidebars-port`
- [ ] 4.3 B3: Gateway appends the font origin to the proxied CSP; `bridge/server.ts` back to upstream; focused case
- [ ] 4.4 B4: fork lint files in their own override block
- [ ] 4.5 B5: prove upstream's STT deadline on Bun 1.4.0; drop `stt-deadline-runtime-port` or keep it at a 1.4.2 floor; update `docs/herdr-fleet.md`
- [ ] 4.6 B6: network-first navigation with precached-shell fallback on network failure only; focused worker cases

## 5. Overlaps

- [ ] 5.1 Dashboard control bar beside the rails; rails tests pass
- [ ] 5.2 Mic+send split mirrored with the left-hand layout; composer suites pass
- [ ] 5.3 Disconnect badge visible on the Pane route; header suites pass
- [ ] 5.4 Record the redaction bypass of the terminal surface (design decision 8)

## 6. Review every entry and record the boundary

- [ ] 6.1 Set `[upstream]` to `v1.18.0`; review every invasive entry (keep, adapt, replace, drop) with its verify list; record the decisions table in the design
- [ ] 6.2 Advance `reviewed = "v1.18.0"`; add the `UPSTREAM.md` row; record check-fork counts before and after
- [ ] 6.3 Both typechecks, lint, build, `test:fork`, `check-private-facts`, focused suites; commit with explicit pathspecs and Unreleased lines

## 7. Verify on the designated member

- [ ] 7.1 Push `main` unreleased (`SKIP_TESTS=1`); run the full suites against that commit on the designated member; classify every failure

## 8. Release and level

- [ ] 8.1 Read the remote's newest tag; cut `chore(release): 3.13.0`; annotated tag `v3.13.0`, pushed by name
- [ ] 8.2 Level the lead, then each member; verify census, the Gateway path, pairing refusal, the registry and a throwaway terminal

## 9. Archive

- [ ] 9.1 Sync specs, validate, archive, commit and push
