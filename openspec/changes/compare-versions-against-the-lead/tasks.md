## 1. Remove the published-release observation

- [x] 1.1 Delete `fleet/version/release-observer.ts` and its test; remove the `/fleet/api/version` route, `FLEET_VERSION_PATH`, `GatewayOptions.versions` and the observer initialisation in `fleet/gateway-main.ts`; replace the route test with one proving the path is no longer a Fleet-owned answer; verify `bun test fleet/gateway.test.ts` passes and `git grep release-observer` finds no live reference
- [x] 1.2 Remove `fetchFleetReleases`, `FleetReleaseObservation` and the release member of `FleetVersionView` from the web data layer and the MSW release handler; verify both typechecks pass

## 2. Compare against the lead

- [x] 2.1 Re-point `fleet/ui/version-evidence.ts` at the lead's runtime version (major.minor only; unusable reference → unknown; no checked-at field) and rewrite its suite to cover compatible, patch skew, outdated, manual-major, development, last-reported, unknown and unusable reference; verify `bun test fleet/ui/version-evidence.test.ts`
- [x] 2.2 Make the root loader retain `self.version` from the same `/api/crew` response as `lead` and stop reading release evidence; update the loader test's optional version discovery block; verify `cd web && bunx vitest run src/lib/loaders.test.ts`
- [x] 2.3 Update the native navigation shell and tree to pass the lead reference and drop freshness rendering; update shell/tree tests; verify those vitest files pass
- [x] 2.4 Delete `fleet.version.lastChecked` and `fleet.version.freshnessUnavailable` from all seven dictionaries; verify `cd web && bun run typecheck` and the i18n test pass

## 3. Documentation, boundary and changelog

- [x] 3.1 Remove the egress-exception paragraph from `AGENTS.md` and rewrite the Version evidence section of `docs/herdr-fleet.md` around the lead reference; verify `git grep -i "fleet/api/version"` matches only OpenSpec history, the CHANGELOG line and the test proving the route is gone
- [x] 3.2 Update `FORK.toml` (contract, verify lists, reasons, comments) and verify `bun scripts/check-fork.ts` reports no unclassified or stale owned path
- [x] 3.3 Add one bold-lead `CHANGELOG.md` line under `## [Unreleased]` and verify `scripts/check-version.sh` passes

## 4. Verification

- [x] 4.1 Run root and web typecheck, `bun run lint`, `bun test ./fleet`, the full `cd web && bunx vitest run`, `bun run test:fork`, `bun scripts/check-fork.ts` and `bun scripts/check-private-facts.ts`, all green
- [x] 4.2 Render the shell with the MSW mock against a synthetic lead version over CDP and capture screenshots showing outdated, compatible, manual-major, development, last-reported and unknown Host rows with no freshness wording
- [x] 4.3 Validate this change with `openspec validate compare-versions-against-the-lead --strict`
