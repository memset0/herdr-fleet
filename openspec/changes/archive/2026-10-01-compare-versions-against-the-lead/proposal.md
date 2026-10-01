## Why

The Fleet is updated by its operator, and the lead is always levelled first, so the published tag line is not the reference a member must match: the lead's own running version is. Observing this product's public Git tags from the Gateway buys nothing the lead does not already know, costs the product its only outbound metadata call, and adds freshness states ("last checked", "freshness unavailable") that describe the tag source rather than the Fleet.

## What Changes

- **BREAKING** Remove the Gateway's published-release observation entirely: the fork-owned `fleet/version/` observer, its suite, and the authenticated `GET /fleet/api/version` route with its initialisation. The Gateway makes no outbound call for version evidence; the egress exception is withdrawn from the working agreement and product documentation.
- Classify each Host row's reported runtime version against the lead's own runtime version from the same `/api/crew` census read (`self.version`): same major.minor is compatible; a lower minor in the same major is outdated; a higher major on the lead is a manual major migration; an explicit SemVer prerelease such as `-dev` is development; an absent or unparseable identity is unknown; a member that is not answering keeps its value as last reported.
- Drop the release-freshness states and their wording in all seven dictionaries; keep outdated, manual-major, development, last-reported and unknown.
- The loader stops reading release evidence; the shell's version view becomes the census's lead version plus member reports.
- The native footer is unchanged: it still shows the page's own build.

Non-goals: any installation, update or restart action; a new peer request, crew protocol field or listener; changing how a member reports its version; comparing patch levels; treating a runtime report as an on-disk installation.

Unchanged Collie behavior remains governed by the adopted Collie v1.14.2 baseline (commit `887a37dbfc5582d08c7d7703deadd53146f654bb`); this change touches only Fleet-owned behavior and the existing narrow loader, type and fake-network ports.

## Capabilities

### New Capabilities

None.

### Modified Capabilities
- `fleet-version-evidence`: the published-release requirement is removed; host classification takes the lead's runtime version as its reference; the shell's version view no longer reads release evidence; the footer no longer mentions release discovery.
- `fleet-native-navigation-sidebars`: Host-row scenarios that relied on fresh release evidence or a stale source now compare against the lead; the footer requirement no longer refers to release discovery.

## Impact

Removed: `fleet/version/release-observer.ts` and its test, the `/fleet/api/version` route in `fleet/gateway.ts` and its wiring in `fleet/gateway-main.ts`, `fetchFleetReleases` and `FleetReleaseObservation` in the web data layer, the MSW release handler. Changed: `fleet/ui/version-evidence.ts` and tests, the root loader's optional version read, the native navigation shell and tree, seven dictionaries, `docs/herdr-fleet.md`, `AGENTS.md`, `FORK.toml`, `CHANGELOG.md`. Release axis: the Gateway and bundle live on the lead and no member runs changed code, so this is a patch-axis change; the removed route is lead-only and authenticated, and no operator configuration or workflow changes.
