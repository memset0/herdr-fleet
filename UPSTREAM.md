# Upstream provenance

The node bridge and React PWA are derived from
[AltanS/collie](https://github.com/AltanS/collie), version **v0.28.0**, commit
`2910f40278f3ca1646fc472dd3589da4a47776e4`.

The upstream Git history and MIT `LICENSE` are retained. Web Remote adds the Fleet Gateway,
single-account authentication, multi-instance routing, SSH transports, and a Herdr-coupled
plugin-owned supervisor. Upstream's Tailscale/system-service control path is intentionally not part
of this derivative's supported workflow. Windows Task Scheduler, QR lifecycle tooling, and
upstream's moving self-update path are likewise excluded.

The dormant `services/ttyd-fallback/` companion is Web Remote-owned generic code, not Collie-derived
source. Its separate ttyd provenance and artifact integrity record live in that directory's
`UPSTREAM.md`, `VERSION`, and `SHA256SUMS`; do not mix its lifecycle into a future Collie import.

Web Remote also carries one browser-local Fleet framing extension: an exact-parent, versioned
activity message gates Collie's `x-collie-seen` read attribution for hidden resident iframes while
standalone Collie keeps upstream behavior. Keep this small protocol, API-header seam, and activation
revalidation together when importing a later upstream release; it owns no persisted state and must
not be replaced by Fleet-side observation storage.

The framed Web bundle additionally accepts four exact-parent, versioned Fleet Explorer actions and
delegates them to Collie's existing typed `createWorkspace`, `createTab`, `renameTab`, and
`renamePane` clients. Keep that allowlist, readiness/result correlation, and request de-duplication
together during an upstream
import. It adds no node HTTP route or CORS surface, and standalone Collie never accepts the protocol.

When importing a later Collie release, start from clean synchronized checkouts with one writer,
preflight a named stable tag, and merge that tag's dereferenced commit from the `upstream` remote so
the release remains Git ancestry. Do not silently follow upstream's default branch. Record the
overlap and boundary decisions, rerun both projects' complete test suites, verify an untagged node
candidate, and update the exact tag and commit above in the accepted release.
