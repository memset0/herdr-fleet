## 1. Fork cases leave upstream test files

- [x] 1.1 Move the optional-version-discovery case out of `web/src/lib/loaders.test.ts` into `web/src/lib/fleet-version-loader.test.ts`
- [x] 1.2 Move the task-delivery cases out of `web/src/components/composer.test.tsx` into `web/src/components/fleet-task-composer.test.tsx`
- [x] 1.3 Move the fixed-Host cases out of `web/src/components/new-space-sheet.test.tsx` into `web/src/components/fleet-host-space-sheet.test.tsx`
- [x] 1.4 Move the favorite-control cases out of `web/src/components/agent-card.test.tsx` into `web/src/components/fleet-agent-card-favorite.test.tsx`
- [x] 1.5 Move the leading-node and declined-mark badge cases out of `web/src/components/app-header.test.tsx` into `web/src/components/fleet-app-header.test.tsx`
- [x] 1.6 Confirm each upstream file is byte-identical to v1.18.0, or report what still holds it

## 2. Configuration beside upstream's

- [x] 2.1 Replace the `.oxlintrc.json` fork block with inline `no-runtime-typeof` suppressions in the three live files, drop the dead entry, return the file to upstream's text, verify oxlint honours the inline form, and state the exception in AGENTS.md's lint rule
- [x] 2.2 Add `fleet/tsconfig.json` extending the root config; run it from the root `typecheck` script; return root `tsconfig.json` to upstream's text; move `bun test ./fleet` into a `test:fleet` script
- [x] 2.3 Add `.github/workflows/fleet.yml` (boundary check with full history, Fleet suites, Fleet browser cases on a Fleet build); return `ci.yml` to upstream's text
- [x] 2.4 Move `docs/herdr-fleet.md` to `fleet/README.md`, fix its links and every reference (AGENTS.md, UPSTREAM.md, FORK.toml, fleet tests); return `cli/docs-embed.test.ts` to upstream's text

## 3. Header chrome by variable scope

- [x] 3.1 Scope `--background: var(--chrome)` to the header from the shell's route column; return `collie-home.tsx` to upstream's text and drop `app-header.tsx`'s fill change
- [x] 3.2 Screenshot header and route in light and dark over CDP against local builds before and after, and compare the header, mark and route colours

## 4. The shell is a Fleet-build property

- [x] 4.1 Add `web/src/lib/fleet-build.ts` and set `VITE_HERDR_FLEET=1` in `scripts/herdr-fleet.sh` and the root `build` script; pin both with `fleet/build-flag.test.ts`
- [x] 4.2 Gate `NativeNavigationShell` and `FleetSettingsSection` on the build; make the Pane route's mark follow the shell's presence
- [x] 4.3 Move the shell-on layout cases from `root.test.tsx` into the shell's own suite with the flag stubbed on; stub it in every fork suite that needs the shell
- [x] 4.4 Return `root.test.tsx`, `settings.test.tsx`, `motion.test.tsx`, `smoke.spec.ts`, `back-goes-up.spec.ts`, `pane-glide.spec.ts`, `dashboard-footer.spec.ts` to upstream's text and narrow `pinned-panes.spec.ts` to the favorites scoping; make `fleet-todoist.spec.ts` require a Fleet build

## 5. Manifest, verification and release

- [x] 5.1 Update `FORK.toml` to the new boundary, with the two corrected attributions; record before/after counts from `bun scripts/check-fork.ts`
- [ ] 5.2 Run focused tests, both typechecks, lint, the build, `bun run test:fork` and the private-facts guard; add the CHANGELOG lines
- [ ] 5.3 Push `main` unreleased and run the full suites on the remote test member against that exact commit, classifying every failure
- [ ] 5.4 Cut the MINOR release, tag it annotated, push branch and tag by name
- [ ] 5.5 Deploy the lead and every member except those excluded; verify versions in the lead's crew census and the lead's shell visually
