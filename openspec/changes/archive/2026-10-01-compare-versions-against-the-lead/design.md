## Context

See `proposal.md` for motivation. The archived `show-fleet-version-evidence` change built four pieces: a fork-owned Gateway observer under `fleet/version/` reading this product's public Git refs; an authenticated `GET /fleet/api/version` route that returned its cached observation; a root-loader read that joined that observation to `/api/crew` member reports into `HomeData.fleetVersions`; and the pure classifier `fleet/ui/version-evidence.ts`, rendered as a second line on each Host row, plus the page-build footer. The census response already carries `self.version`, the lead's own runtime identity, beside `members[].version`, so the reference this change needs arrives in the read the loader already makes.

## Goals / Non-Goals

**Goals:**

- Delete the observer, its route and its wiring, so the Gateway has no outbound path for version evidence.
- Make the lead's runtime version, from the same census response, the classifier's only reference.
- Remove freshness/last-checked states and wording everywhere they surface.
- Keep the footer, the Host row geometry, and every connectivity behavior exactly as they are.

**Non-Goals:**

- Any change to how members report versions, to the crew protocol, or to the census route.
- A replacement source for "what is the newest release" — the operator knows, and the lead is levelled first.

## Decisions

### The reference is the census's `self.version`, compared at major.minor

The loader already reads `/api/crew` for member reports. It now also retains `self.version` from that same response as `lead`. The view becomes `{ lead: string | null; members: Array<{ id; version? }> }`. Taking both from one response keeps the pair coherent: there is no moment where the rows compare against a reference read at another time, which is why no freshness qualifier is needed.

The classifier parses both sides with the existing SemVer pattern. The lead's prerelease and build metadata are ignored for the reference: the lead deploys commits, so between releases it legitimately runs `x.y.z-dev+sha`, and its major.minor is still what members must match. A member's own prerelease still makes it `development`, because that describes the member, not the reference.

Order of precedence, unchanged where it existed: unparseable member → `unknown`; not answering → `last-reported`; member prerelease → `development`; unusable reference → `unknown`; lead major above member → `manual-major`; same major, lead minor above member → `outdated`; otherwise → `compatible`. A member ahead of the lead stays `compatible`, as a member ahead of the newest tag did before: it is not behind, and the lead-first rule makes it a transient of an in-progress rollout.

An unusable reference yields `unknown` rather than `compatible`, so the row never asserts a conclusion it could not reach. In practice the lead always reports its manifest version, and a census failure already empties member reports.

Alternatives rejected:

- Keep the observer but stop rendering it: retains the egress and the code for no reader.
- Compare against the page's own build (`__BUILD_INFO__`): that is the bundle, which can be rebuilt without the lead's Collie restarting, so it can disagree with what the lead's backend actually runs; the census's `self.version` is the running process.
- A new lead-version route: the census already carries the value.

### The removal is whole, and the boundary moves with it

`fleet/version/` and its test are deleted; `GatewayOptions.versions`, `FLEET_VERSION_PATH` and its `isApiPath` clause, the route block, and `createFleetReleaseObserver()` in `gateway-main.ts` go. The Gateway test that pinned the route is replaced by one asserting `/fleet/api/version` now falls through to the Collie proxy like any unknown path below the session gate (no Fleet-owned answer). `fetchFleetReleases` and `FleetReleaseObservation` leave `api.ts`/`types.ts`, and the MSW handler goes.

`FORK.toml`: the `fleet-runtime` contract "cached read-only annotated stable release observation" and every `verify` reference to the deleted suite go; `fleet/**` still covers the remaining owned files, so no owned path is left stale. `unnarrowed-pack-rows-port` keeps its anchors (the loader's `allWorkspaces?` field and the loader test's `optional version discovery` block, which keeps that name) and its reason drops the release read. `repository-guidance` loses the egress comment and intent wording. `fake-network-fleet-routes` and `native-manual-pane-fit-port` drop release-handler and release-type mentions. `native-agent-favorites-port`'s comment drops "freshness".

`AGENTS.md` loses the "fixed, bounded, credential-free outbound metadata observation" paragraph, which leaves the preceding bridge-boundary statement true again for the Gateway too. `docs/herdr-fleet.md` rewrites its Version evidence section around the lead reference.

### Seven dictionaries lose two keys

`fleet.version.lastChecked` and `fleet.version.freshnessUnavailable` are deleted from all seven typed dictionaries; `tsc` enforces they change together. Outdated, manual-major, development, last-reported (and its development variant), unknown and the footer name stay.

### Axis: patch

The Gateway, the loader and the bundle run on the lead only; no member executes changed code, no configuration key, contract the operator relies on, or workflow changes. The removed route was lead-only, authenticated and read by this product's own bundle alone. Under the working agreement's axis — "PATCH: the lead alone redeploys. A change confined to the frontend bundle, or to the gateway that serves it" — this is a patch. The commit carries `!` because an HTTP route disappears, but the release number follows the redeploy axis, not API visibility.

## Risks / Trade-offs

- [The lead is mid-upgrade and members legitimately trail by a minor] → they read "Outdated" until levelled, which is the true state and exactly what the label is for.
- [A member was levelled before the lead] → it reads compatible; the lead-first rule makes this rare and it carries no false warning.
- [The census fails] → members and reference empty together; rows read "Version unknown" and connectivity is unaffected.
- [Lead runs a `-dev` commit build] → its major.minor still serves as reference; the lead's own row reads development, which is true.

## Migration Plan

Delete observer and route, re-point the classifier, adjust loader/types/shell/tree and dictionaries, update docs, `AGENTS.md`, `FORK.toml` and `CHANGELOG.md`, then run the full verification set. Deploying the lead alone completes it; no data, configuration or member action is required. Rollback is reverting the commit.
