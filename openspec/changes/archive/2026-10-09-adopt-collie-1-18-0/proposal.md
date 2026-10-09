## Why

The tree corresponds to Collie `v1.17.2` (tag object `b73f66bcafd40b75adc93abc838c7e5c49c30d00`,
commit `3d562ae5f8ca1b5bcbf8c4cab10064c955d5c704`; Herdr Fleet 3.12.0). Upstream published `v1.18.0`
on 2026-10-08: 54 commits over 423 files past the baseline. Its central change is ADR 0086: pairing is
always on, and every `/api/*` route except `GET /api/health` and `POST /api/pair` needs a paired
device's bearer token, reads included. Collie's own host credential is refused on any request that
carries a proxy header. Behind the Fleet Gateway, which authenticates the operator itself and forwards
no browser credential, an unmodified adoption would answer every proxied request with
`403 device not paired`, and the web app would wipe its stored state on that body.

The release also brings five new dictionaries (twelve in all), a single dashboard control bar, a
left-hand layout and Send now, secret masking, an offline read-only mode, and a disconnect badge on
the Collie mark. Several of those meet the fork's ports. The owner has approved a set of
simplifications to land with the adoption, because the same ports are being re-read anyway.

## What Changes

- Adopt Collie `v1.18.0`, tag object `990260b86d08b7e41f62fe5f2ed9a7e928d4b637`, commit
  `2ab62eaac43c8971fc698f81a2465d3059fce938`, as one three-way merge whose second parent is that
  commit, after a clean-tree preflight. `CLAUDE.md` stays the relative symlink to `AGENTS.md`. The
  version files stay `3.12.0` until the release commit.
- **The Gateway is Collie's one paired device** (ADR 0086, owner's "plan A", no new invasive path).
  A fork-owned `fleet/collie-pairing.ts` runs on a lead before the Collie child starts, beside the
  trust-state validation. Through upstream's own `bridge/pairing.ts` exports it revokes any previous
  `fleet-gateway` device and enrols a fresh one, refusing on a label conflict. The token lives only in
  the supervisor's and the Gateway's memory and is rotated on every Fleet start. The Gateway adds it as
  the bearer on every request it proxies, including its own internal reads, and still drops the
  browser's own `Authorization`. The Gateway refuses `POST /api/pair` and the device-revocation write
  with a body of its own, never `device not paired` or `device expired`. A clean stop revokes the
  device again, so a stopped lead holds no live Gateway credential. The lead's readiness probe moves
  to `/api/health`. No operator action is needed.
- **Fork strings leave upstream's dictionaries.** The fork's keys (about 185, `fleet.*` and a few
  others) move from upstream's typed dictionaries into a fork-owned `web/src/lib/fleet-i18n/` with
  `ft()`. It follows upstream's active locale through its exported snapshot and subscription, uses
  upstream's `interpolate`, carries the fork's seven languages and falls back to English. Upstream's
  twelve dictionaries carry no fork key.
- **FORK.toml bookkeeping.** Fork-created paths already listed under the `fleet-runtime` owned entry
  leave the `native-navigation-sidebars-port` path list.
- **The font origin moves out of Collie's source.** `bridge/server.ts` returns to upstream's text.
  The Gateway appends the fetched font provider's origin to `style-src` and `font-src` of the
  `content-security-policy` header on the responses it proxies. Script, connect, frame and base-uri
  sources are untouched.
- **Fork lint overrides stand in their own block.** The fork's parse-boundary files move out of
  upstream's `no-runtime-typeof` override and its comment, into one override block of their own.
- **The Bun floor is 1.4.0.** The fork's declared floor rises to 1.4.0, where a direct
  `AbortSignal.timeout` stays armed across a listener gap. `stt-deadline-runtime-port` is dropped and
  `bridge/stt/provider.ts` returns to upstream's text, once upstream's code is shown correct on 1.4.0.
- **Offline cold start.** The service worker keeps navigation network-first and answers from the
  precached app shell only when the network itself fails, so 1.18's offline read-only mode can open.
  An HTTP answer from the Gateway, 401 and redirects included, always wins and is never cached.
- **Overlaps settled at review.** Upstream's single dashboard control bar sits beside the rails. The
  fork's mic-and-send split is kept and mirrors with upstream's left-hand layout. The Pane route still
  declines the Collie mark, and the disconnect badge stays visible there. The fork's terminal surface
  is not covered by upstream's secret masking, which is recorded in the design.
- Review every invasive entry against `v1.18.0` and advance it. Set `[upstream]`, add the
  `UPSTREAM.md` row and make `v1.18.0`'s changelog the byte-exact prefix of `COLLIE_CHANGELOG.md`.
- Release axis **MINOR, 3.12.0 → 3.13.0**, cut after the full suites pass on a designated member.

**Non-goals:**

- No specification of upstream behaviour, and no port beyond what the release and the approved
  simplifications require.
- No pairing on a peer: no browser reaches a peer's Collie, and the crew link keeps its own trust.
- No Fleet ownership of `COLLIE_REDACT`; masking stays upstream's setting.
- No translation of the fork's strings into the five new languages; they read English.
- No port of upstream's `CLAUDE.md` changes into `AGENTS.md`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-public-authentication`: the Gateway holds Collie's pairing credential, refuses pairing
  writes, and the service worker falls back to the app shell only on a network failure.
- `fleet-stt-deadline-compat`: the deadline guarantee is met by the runtime floor, not a fork helper.
- `fleet-composer-voice`: the record control and Send mirror together in the left-hand layout.
- `fleet-pane-chrome`: the Pane route still declines the mark, and the connection badge stays visible.

`fleet-upstream-sync` carries no delta. This adoption follows it as written.

## Impact

- Everything Collie changed between `v1.17.2` and `v1.18.0`. Crew protocol stays 2. `MIN_BUN` is
  upstream's 1.3.14; the fork's own floor is 1.4.0.
- Predicted conflicts (`git merge-tree`): 21 paths, every one inside a declared entry. The preflight
  reports 19 disturbed and 11 untouched entries and no owned path occupied.
- Fork-owned: `fleet/collie-pairing.ts`, `fleet/daemon.ts`, `fleet/runtime.ts`, `fleet/proxy.ts`,
  `fleet/gateway.ts`, `fleet/gateway-main.ts`, `web/src/lib/fleet-i18n/` and every fork component
  that reads a fork string, `fleet/stt-deadline.*` (removed), `FORK.toml`, `UPSTREAM.md`,
  `COLLIE_CHANGELOG.md`, `CHANGELOG.md`, `docs/herdr-fleet.md`.
- Upstream paths returning to upstream's text: `bridge/server.ts`, `bridge/stt/provider.ts`, and the
  fork keys in the seven dictionaries.
- Operators: every member redeploys (MINOR), lead first. No configuration key, enrolment step or state
  file changes. Each machine needs Bun 1.4.0 or later.
