# Upstream provenance

The node bridge and React PWA are derived from
[AltanS/collie](https://github.com/AltanS/collie), version **v0.36.1**, commit
`96c3bc3374ea49920ba1c62cfe3135277e16bf00`. The exact annotated release tag is retained through
the second parent of Web Remote's v0.36.1 adoption merge; later Collie commits and releases are not
part of this provenance boundary.

The upstream Git history and MIT `LICENSE` are retained. Web Remote adds the Fleet Gateway,
single-account authentication, multi-instance routing, SSH transports, and a Herdr-coupled
plugin-owned supervisor. Upstream's Tailscale/system-service control path is intentionally not part
of this derivative's supported workflow. Windows Task Scheduler, QR lifecycle tooling, and
upstream's moving self-update/major-update path are likewise excluded. Web Remote also does not
adopt v0.36.1's `COLLIE_PUBLIC_URL`, `COLLIE_SERVE_PORT`, `collie-ctl.sh`, Tailscale publication, or
OS-service lifecycle; its Herdr plugin manifest, Gateway, and supervisor remain the only supported
runtime ownership path.

The v0.36.1 import retains Collie's guarded plan-feedback and password/no-echo input handling,
complete and partial draft safeguards, socket write draining, native Codex, Grok Build, OMP, and
AGY harnesses, per-root journal diagnostics, operator-owned `commands.toml`, `keys.toml`, and
`quick-replies.toml`, F1–F12 support, tap-to-type preference, optional audit-content redaction,
sanitized terminal titles, Push subscription maintenance, proxy-auth recovery, fail-closed
Host/bind/peer validation, upload sniffing, and bounded dated `sessionStorage` mirrors. Web
Remote-specific tests keep those additions inside the existing Host/Origin, text-only,
History-containment, framed-seen, Fleet-projection, and manual-resize boundaries.

Codex is wholly upstream-owned at this baseline. Web Remote uses v0.36.1's native 0.150.x status,
placeholder, paste-token, continuation, and prompt-binding design without a downstream adapter.
Earlier Web Remote releases carried temporary custom-status, queue-footer, slash-palette, chunking,
and extended stable-read patches; those commits remain in Git and the changelog, but their code,
fixtures, tests, and active `FORK.toml` entry do not survive this adoption. States that v0.36.1
cannot verify remain fail-closed rather than restoring one of those local paths.

The dormant `services/ttyd-fallback/` companion is Web Remote-owned generic code, not Collie-derived
source. Its separate ttyd provenance and artifact integrity record live in that directory's
`UPSTREAM.md`, `VERSION`, and `SHA256SUMS`; do not mix its lifecycle into a future Collie import.

Web Remote also carries one browser-local Fleet framing extension: an exact-parent, versioned
activity message gates Collie's `x-collie-seen` read attribution for hidden resident iframes while
standalone Collie keeps upstream behavior. Keep this small protocol, API-header seam, and activation
revalidation together when importing a later upstream release; it owns no persisted state and must
not be replaced by Fleet-side observation storage.

The framed Web bundle additionally accepts six exact-parent, versioned Fleet Explorer actions and
delegates them to Collie's existing typed `createWorkspace`, `createTab`, `renameTab`, and
`renamePane`, `closeTab`, and `closePane` clients. Keep that allowlist, readiness/result correlation,
and request de-duplication
together during an upstream
import. It adds no node HTTP route or CORS surface, and standalone Collie never accepts the protocol.

The framed Web bundle also carries a generic versioned Fleet shortcut controller. Fleet owns every
chord and label; the child accepts bounded active binding configuration from its exact parent,
forwards shortcut ids only, and exposes an allowlisted command handler that registers AgentChat's
existing `resizeToMirror()` callback. Keep the controller startup, strict config/intent/command/
result schemas, correlation/de-duplication, and AgentChat registration together during an upstream
import, including its capture listener and bounded document-load/Pane-handler registration grace.
Do not move the registry into Collie, duplicate the resize measurement, forward raw key events,
retry the API, or activate the bridge in standalone Collie. A future existing-action binding belongs
in Fleet's single registry and tests; a new action requires a deliberate allowlist adapter.

When importing a later Collie release, start from clean synchronized checkouts with one writer,
preflight a named stable tag, and merge that tag's dereferenced commit from the `upstream` remote so
the release remains Git ancestry. Do not silently follow upstream's default branch. Record the
overlap and boundary decisions, rerun both projects' complete test suites, verify an untagged node
candidate, and update the exact tag and commit above in the accepted release.

The executable current-state inventory is [`FORK.toml`](./FORK.toml). Run
`bun run scripts/check-fork.ts` for ordinary changes and
`bun run scripts/review-upstream.ts --target <commit>` before a synchronization. Every invasive
entry requires a decision even when the selected target did not touch its file; owned target-path
collisions are reviewed separately. Keep detailed synchronization evidence outside the compact
manifest.
