## Why

The native Fleet shell reports connectivity but cannot distinguish a compatible host from one running an older Fleet minor, and it does not identify the Fleet build serving the page. Operators need truthful version evidence without giving the browser or Gateway installation authority.

## What Changes

- Add a Fleet-owned, read-only observer for this repository's annotated stable version tags, with numeric SemVer ordering, bounded source requests, coalesced caching, and explicit freshness.
- Expose one authenticated shared-shell version view that combines release evidence with the member versions already reported by `/api/pack`; do not add per-host requests or Pack protocol fields.
- Show each host's full observed runtime version when it is parseable (an unparseable identity reads only "Version unknown") and distinguish compatible, outdated, manual-major, last-reported, unknown, and development states independently of connectivity.
- Show the current page's Herdr Fleet build identity below the existing Collie/TTYD surface selector in both desktop and mobile navigation.
- Keep release discovery and rendering in fork-owned modules, using only narrow ports in the existing Gateway route, React Router loader, and native shell.

Non-goals: installing, restarting, enrolling, publishing, selecting a deployment target, adding browser update controls, using Collie's updater or release feed, changing Pack trust or wire protocol, or treating an observed runtime version as proof of an on-disk installation.

Unchanged Collie behavior remains governed by the exact adopted Collie v1.5.2 baseline at commit `cea2035e1f02d560d1bac66c85314828a7e01c20`; this change specifies only Fleet-owned additions and narrow integration ports.

## Capabilities

### New Capabilities
- `fleet-version-evidence`: Read-only stable-release observation, host runtime-version classification, and current-page Fleet build identity.

### Modified Capabilities
- `fleet-native-navigation-sidebars`: Host rows gain independent version evidence and the shared desktop/mobile footer gains the page's Fleet build identity.

## Impact

Affected product areas are a new owned Gateway observer, an authenticated Gateway read route, the root React Router loader and shared shell model, native hierarchy host rows, shared footer composition, all translation dictionaries, public product documentation, `CHANGELOG.md`, and `FORK.toml`. The change adds no dependency, listener, credential, peer request, Pack wire field, updater call, version bump, release, or deployment.