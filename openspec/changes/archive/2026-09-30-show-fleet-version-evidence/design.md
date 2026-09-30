## Context

See `proposal.md` for motivation. The adopted upstream baseline is Collie v1.5.2 at commit `cea2035e1f02d560d1bac66c85314828a7e01c20`. Fleet's authenticated Gateway already owns `/fleet/api/settings` above the Collie proxy; `/api/pack` already reports each running member's last observed full version; the root React Router loader already drives every navigation surface and revalidates on the shared polling cadence. `__BUILD_INFO__` already identifies the exact page bundle. None of these facts currently meet in the native hierarchy.

The two other active product changes affect terminal replay and STT deadline compatibility, not this route or UI slice. This design adds no dependency and changes no Pack wire, trust, enrollment, lifecycle, or Collie updater behavior.

## Goals / Non-Goals

**Goals:**

- Observe this product's formal stable tags once per shared cache interval with explicit freshness and bounded failure behavior.
- Derive host version states from `/api/pack` runtime observations and render them without changing health or navigation.
- Put the page build below the existing surface selector through one shared footer on desktop and mobile.
- Keep behavior in Fleet-owned modules and spend only narrow existing loader, Gateway, and shell ports.

**Non-Goals:**

- Installation, restart, update selection, publication, SSH access, another peer request, a Pack protocol field, GitHub Releases, branch-head comparison, or a browser update action.
- Proving a member's on-disk checkout from its running process identity.
- Changing Collie's existing update banner, build-staleness action, Pack overview, or surface-toggle semantics.

## Decisions

### One bounded observer belongs to the authenticated Fleet Gateway

Add a fork-owned observer under `fleet/version/`. It reads the fixed public repository's Git refs API and accepts only refs named exactly `refs/tags/vMAJOR.MINOR.PATCH` whose Git object type is `tag`; lightweight tags, prereleases, malformed refs, branches, and Releases are not evidence. It parses each numeric component and retains only the greatest stable version per major plus the greatest stable version overall.

The observer owns a five-minute fresh interval, a bounded source timeout, a one-minute retry floor after failure, one retained successful value, and one in-flight Promise. Concurrent callers therefore coalesce, a shell poll normally reads memory, and source failure cannot turn every subsequent row or poll into another outbound call. A successful response carries `checkedAt` and `freshUntil`; a retained result past `freshUntil` is `stale`, and no successful result is `unavailable`. The observer never stores credentials and exposes no mutation.

Expose it at `GET /fleet/api/version`, beside Fleet settings and below the Gateway's existing session gate. Other methods are refused. The route is unavailable without the Fleet Gateway and cannot be reached through the unauthenticated Collie listener. This deliberately adds one bounded outbound public-metadata call to Fleet's security posture; update `AGENTS.md` and product documentation rather than leaving the previous “no outbound call except STT” statement false.

Alternatives rejected:

- Collie's update feed and GitHub Releases: they describe the upstream product and this repository intentionally publishes no Releases.
- `git ls-remote` from the request path: it spawns a process, does not naturally share the Gateway's request timeout, and adds toolchain dependence to display.
- A browser GitHub request: it expands CSP/egress, leaks viewer network metadata, loses the authenticated application boundary, and duplicates requests by browser.
- A per-row route or Pack wire field: version observations already exist in `/api/pack`; another member request rate or protocol field would create authority where none is needed.

### React Router loads one combined version view for the whole shell

Add a typed frontend call for the Fleet release route. The root loader starts `/api/pack` and release-evidence reads beside the required snapshot but never awaits either optional source. The first usable snapshot and navigation therefore remain independent; the retained view is picked up by the next ordinary React Router revalidation after those reads settle. `/api/pack` remains the source of member runtime identities; its 404 means no member observations, not a loader error.

The loader combines the two results as:

```ts
interface FleetVersionView {
  release: {
    latest: string | null;
    majors: Array<{ major: number; version: string }>;
    checkedAt: number | null;
    freshUntil: number | null;
    freshness: "fresh" | "stale" | "unavailable";
  };
  members: Array<{ id: string; version?: string }>;
}
```

The last view is retained module-locally for the same page lifetime as the existing snapshot cache, so offline navigation can keep honest last-reported identities. React Router revalidation refreshes this field at the existing cadence. Components read only `HomeData.fleetVersions`; they start no request and own no timer.

### A pure owned classifier keeps release freshness apart from connectivity

Add `fleet/ui/version-evidence.ts`, free of React and network access. It parses stable reported SemVer with optional build metadata, recognizes any prerelease (including `-dev`) as development, and compares numeric major/minor only when release evidence is fresh. It returns one of:

- `compatible` — fresh evidence establishes no newer minor or major; not rendered as a warning;
- `outdated` — a higher minor exists in the reported major;
- `manual-major` — a greater published major exists;
- `development` — the report is not a formal stable identity;
- `last-reported` — the host is not currently answering but retains a parseable identity;
- `release-stale` — a reachable formal identity exists, but only an expired successful release check is retained;
- `release-unavailable` — a reachable formal identity exists and no successful release check exists;
- `unknown` — no parseable member identity exists; the row reads "Version unknown" and never echoes an unparseable raw value, which is arbitrary member text.

`last-reported` takes precedence over release conclusions, because an offline process cannot freshly prove its version. `development` takes precedence over numeric comparison. For every parseable identity the row keeps the full reported value; it never substitutes the latest tag.

The hierarchy model carries this small display value on Host rows only. The web shell joins `/api/pack` observations to the existing server roster by member id, and the hierarchy row renders the localized label in a trailing line below the host name/health line. That second line avoids squeezing the existing fault word out of a narrow rail and preserves the first line's fixed geometry. Connectivity still owns glyph, tint, sort, folding and actions.

### One Fleet footer composes the existing toggle and build identity

Add a fork-owned `FleetNavigationFooter` that renders `FleetPaneSurfaceToggle` unchanged followed by a compact `Herdr Fleet` label from `BUILD.version` and `BUILD.sha`. A bare stable numeric version remains sans; a qualified page version and the available commit identity wear mono, following `DESIGN.md` section 5. The label is the page bundle, so it does not subscribe to release evidence, selected host, or server-build state.

Both the desktop `Rail.footer` and mobile drawer mount this same component. The existing border remains owned by each containing surface, so the shared component owns spacing and content but not a second seam or safe-area inset.

### Fork boundary and release bookkeeping move with source

New `fleet/version/**`, `fleet/ui/version-evidence.ts`, and fork-named web components are added to the existing `fleet-runtime` owned root and verification inventory. Narrow edits to `fleet/gateway.ts`, `fleet/gateway-main.ts`, `web/src/lib/api.ts`, `web/src/lib/loaders.ts`, the shared test network, all typed dictionaries, and the already-declared native navigation port are recorded at stable concern-specific anchors. `CHANGELOG.md` receives one crisp Unreleased addition; the three version files do not move.

This is patch-axis: the Gateway and browser bundle live on the lead and members execute no changed code. No release is cut or published by this change.

## Risks / Trade-offs

- **Public tag metadata is temporarily unavailable:** keep one bounded stale observation, qualify it, and retry no more often than the failure floor; navigation remains independent.
- **A tag name looks stable but is lightweight:** require Git object type `tag`; never infer form from the name.
- **Runtime and disk differ:** label the value as observed/reported and never as installed.
- **A crowded Host row shifts existing health copy:** use a dedicated second line inside the already variable-height Host row; health remains at its current trailing position.
- **The source exceeds the observer's response bound:** reject the check rather than parsing partial tag evidence; retain and qualify the last successful observation when one exists.
- **The new Gateway egress changes the prior security statement:** document the exact fixed metadata-only exception and keep credentials, redirects, arbitrary URLs, request bodies, and source selection out of the API.

## Migration Plan

Implement the owned observer and classifier first, then expose the authenticated read route and connect the root loader. Integrate Host row labels and the shared footer, update all dictionaries, public documentation, changelog and `FORK.toml`, and run focused observer/classifier/Gateway/UI checks plus both typechecks and strict OpenSpec validation after concurrent edits settle. No persisted data migration, configuration change, version bump, release, tag, deployment, or live service mutation is required. Rollback removes the read route and labels and restores the selector-only footer; existing navigation and `/api/pack` remain unchanged.