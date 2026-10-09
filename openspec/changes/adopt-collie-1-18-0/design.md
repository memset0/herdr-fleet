## Context

See proposal.md, "Why". The ground was read before anything changed:

```
baseline  v1.17.2  tag b73f66bc…  commit 3d562ae5…   (FORK.toml [upstream]; = merge-base main v1.18.0)
target    v1.18.0  tag 990260b8…  commit 2ab62eaa…   54 commits, 423 files, released 2026-10-08
preflight (bun scripts/check-fork.ts --target v1.18.0, before this change existed, no active change):
          19 of 30 invasive entries disturbed; 11 untouched (pane-surface-route-port,
          authenticated-navigation-cache, native-manual-pane-fit-port, private-fact-guard-port,
          fork-gate-in-ci, no-automatic-release-publication, upstream-removal-clock, downstream-docs,
          codex-headless-status-row-port, stt-deadline-runtime-port, stable-table-corpus-test);
          no owned path occupied
boundary  bun run test:fork: 21 pass; 871 owned and 94 invasive paths
```

`git merge-tree --write-tree --name-only HEAD v1.18.0^{commit}` predicts 21 conflicted paths, all
inside declared entries (decision 2 records each resolution).

What `v1.18.0` requires of an operator, read from the changelog and the source:

- **Pairing (ADR 0086).** Every `/api/*` route except `GET`/`HEAD /api/health` and `POST /api/pair`
  needs a paired device's bearer token. The host's local credential (`<state>/local-secret`) is a read
  credential, accepted from loopback only and never on a request carrying a proxy header. A `403`
  whose body is exactly `device not paired` or `device expired` makes the web app run its wipe.
- **Configuration.** One new Collie setting, `COLLIE_REDACT` (default on). Nothing is renamed or
  removed; Fleet owns none of it.
- **State.** Collie adds `local-secret` beside its other state files; nothing is renamed.
- **Runtime.** `MIN_BUN` stays 1.3.14. Crew protocol stays 2.

**Answer: no operator configuration changes.** Decision 1 removes the one step 1.18 would otherwise
ask of a Fleet operator (`collie pair`).

## Goals / Non-Goals

**Goals:** `v1.18.0` as real ancestry, every port reviewed; the Gateway working behind always-on
pairing with no operator step and no new invasive path; the six approved simplifications; the four
named overlaps settled explicitly.

**Non-Goals:** as in proposal.md.

## Decisions

### 1. Plan A: the Gateway is Collie's one paired device

Three ways were considered. Collie's local credential is refused on any request carrying a proxy
header, which every Gateway request does, and stripping those headers would make Collie see the
Gateway as the host's own CLI — a read-only credential besides. A Gateway that answered Collie's
pairing flow on the operator's behalf would need an operator step. Plan A uses Collie's own registry:

- `fleet/collie-pairing.ts` (fork-owned) imports `PairingStore`, `filePairingIo`, `generateToken` and
  `sha256Hex` from `bridge/pairing.ts`. `enrolGatewayDevice(stateDir)` revokes any `fleet-gateway`
  device, adopts a fresh one (`PairingStore.adopt`, which writes nothing and returns the colliding
  labels when the label is still taken), throws when any label is returned, and answers the token.
  `revokeGatewayDevice(stateDir)` drops it again.
- `fleet/daemon.ts` calls it on a lead directly after `validatePackAuthority`, before any child
  exists, so Collie never writes the registry concurrently. The token is handed to the Gateway child
  in its environment (`HERDR_FLEET_COLLIE_TOKEN`), which `gateway-main.ts` reads once and deletes from
  its own `process.env`, so no grandchild (`herdr terminal attach`) inherits it. The supervisor keeps
  it in the child spec, so a Gateway the supervisor restarts gets the same token. A Collie child the
  supervisor restarts reads the same registry file, whose hash only this generation ever wrote.
  Collie's own writes to that file are `lastSeenAt` stamps, re-derived from disk, and the two routes
  the Gateway refuses.
- A clean shutdown revokes the device after the children stop. That makes a rollback to 3.12.x (Collie
  1.17.2, where a non-empty registry switches its write gate on) start from an empty registry without
  an operator step. A crash leaves the entry; the next start replaces it.
- `fleet/proxy.ts` `upstreamRequestHeaders` sets `authorization: Bearer <token>` after building the
  allowlist, which never contained the browser's `authorization`. `proxyCollie` is the only path to
  Collie, so the bindings inventory and every public-asset read carry it too.
- `fleet/gateway.ts` refuses `POST /api/pair` and every non-read under `/api/devices` with
  `403 pairing is managed by Herdr Fleet` before the proxy. That body is not one of the two the web
  app wipes on. v1.18.0's device writes are exactly `POST /api/pair` and `POST /api/devices/revoke`;
  the expiry verbs are CLI-only, and the standby door's claim is its own listener.
- Readiness probes `GET /api/health`, one of the two open routes.
- Peers enrol nothing. The lead consumes a peer through `/crew/v1/*`, which the front gate never
  reaches (pinned mutual TLS plus the crew secret), and no browser reaches a peer's Collie.

A browser still holds no token of its own. Collie 1.18's Settings → System card therefore offers its
pair form (it keys on a missing local token), and the connection card says the device is not paired.
No refusal latch is ever set, so the dashboard, read-only banner and tour never show a pair prompt.
That residue is recorded for the owner rather than patched (decision 9).

### 2. Merge and conflict resolution

The planning commit lands first; the preflight then runs with `--allow-active-changes`, which the
owner's end-to-end authorization of this adoption covers. `git merge --no-ff --no-commit
'v1.18.0^{commit}'`; `MERGE_HEAD` must be `2ab62eaa…`. Contracts as at every adoption: `CLAUDE.md`
stays the symlink, `CHANGELOG.md` is ours plus one Unreleased line, the version files keep `3.12.0`,
`herdr-plugin.toml` keeps this product's identity, `COLLIE_CHANGELOG.md` takes `v1.18.0`'s changelog
as its prefix. The merge commit is `2b1fc08c` (parents `62ca8e3b`, `2ab62eaa`).

| path | entry | resolution |
| --- | --- | --- |
| `CLAUDE.md` (type) | `repository-guidance` | the relative symlink kept; upstream's file not imported |
| `CHANGELOG.md`, `herdr-plugin.toml`, `package.json`, `web/package.json` | `downstream-version-line`, `plugin-identity`, `fleet-build-port` | ours; upstream changed only its version line |
| `.oxlintrc.json` | `lint-parse-boundary` | upstream's list and comment (its new `worktree-receipts.ts`); the fork's four files in their own block (B4) |
| `bridge/server.ts` | `native-webfont-port` | upstream's text (B3); the Gateway widens the policy |
| `bridge/mux/herdr/adapter.ts` | `terminal-binding-pin-port` | upstream's `toMuxSpace(w, repo)` beside the fork's `bindingSession` argument |
| `bridge/solo-baseline.test.ts`, `web/src/lib/solo-baseline.test.ts` | `terminal-binding-pin-port` | the inventory admits both `bindingId`/`bindingSession` and upstream's `gitHead` |
| `web/e2e/smoke.spec.ts` | `native-navigation-sidebars-port` | upstream's heading query, still scoped to the route's main region |
| `web/src/components/agent-chat.tsx` | `native-pane-page-port` | upstream's saved-copy Chat read keeps the fork's `chatOffered` gate; the tab row's trailing fold stays empty |
| `web/src/components/agent-list.tsx` | `native-agent-favorites-port` | the star props beside upstream's `stale` |
| `web/src/components/app-header.tsx` | `native-navigation-sidebars-port` | `leading` beside upstream's `lastSeenAt`; the mark claim gates `CollieHome`, and a declined mark draws the lost badge (decision 8) |
| `web/src/components/collie-home.tsx` | `native-pane-chrome-port` | `paper` beside upstream's `online` and `lastSeenAt` |
| `web/src/components/composer.tsx`, `composer.test.tsx` | `composer-voice-rank-port` | upstream's `stale`/`hand`; the record control stays its own control, now also refused offline; Send keeps the fork's refusals beside upstream's offline one; both test blocks kept |
| `web/src/components/new-space-sheet.tsx`, `.test.tsx` | `host-workspace-form-port` | `fixedHost` beside upstream's `branchOff`; the host row hides for either |
| `web/src/routes/detail.tsx` | `native-pane-content-port` | upstream's `FileLinksProvider` and saved-copy props, plus `renderContent` |
| `web/src/routes/root.tsx` | `native-navigation-sidebars-port` | the shell wraps upstream's `AppHeaderHost`, which now wraps the strip band and the outlet |

After the merge, two fork-owned tests met upstream's changed layout: the rails now reserve the top
inset unconditionally, because the band is an overlay below the header that owns the inset
(`native-navigation-shell`), and the rail's summary reads the count's spelled word
(`native-agent-rail`).

### 3. Fork strings in a fork-owned dictionary (B1)

`web/src/lib/fleet-i18n.ts` carries the fork's English dictionary as the source of truth and its six
other languages as lazily imported modules beside it, exactly as upstream splits its own. `ft(key,
vars)` reads `getLocaleSnapshot().locale`, serves that language's fork dictionary once it has
landed, English otherwise, and fills slots with upstream's `interpolate`. `useFleetLocale()` subscribes
to both upstream's `subscribeLocale` and the fork's own loader, so a component re-renders when either
the locale or a fork bundle changes. The key type is the fork's own; upstream's `MessageKey` gains
nothing. Every key is removed from upstream's dictionaries, which are byte-identical to `v1.18.0`'s.
No upstream prop typed `MessageKey` needed a Fleet key, so no key stayed behind. Three upstream call
sites read a Fleet string and now call `ft`: the star's label (`agent-card.tsx`, which also calls
`useFleetLocale()` beside its own `useLocale()`), the microphone commands' refusal sentence
(`composer.tsx`) and the Maple typeface note (`typeface-control.tsx`). The last one fixes a slip found
on the way: `noteKey` never returned the Maple entry, so Maple showed the operator-face note. Four
keys no code read (`fleet.todoist.expand`, `collapse`, `completeTask`, `reopenTask`) were dropped,
leaving 181. One upstream browser-tier case read a Fleet label out of Collie's English dictionary
(`e2e/back-goes-up.spec.ts`) and reads Fleet's instead. `fleet-i18n.test.tsx` pins the split, the
parity of keys and slots across Fleet's seven files, the English fallback and the repaint.

### 4. Bookkeeping (B2) and lint (B4)

`native-navigation-sidebars-port` loses the fork-created paths already owned by `fleet-runtime`.
`.oxlintrc.json`'s fork files leave upstream's boundary override; one fork override with its own
comment holds them and the same rule settings. `lint-parse-boundary` keeps one anchor in the file.

### 5. The font origin in the Gateway (B3)

`bridge/server.ts` returns to upstream. `fleet/proxy.ts` widens a proxied `content-security-policy`
header by appending the catalog's one stylesheet origin to `style-src` and `font-src` (adding
`font-src 'self' <origin>` when absent, since it would otherwise inherit `default-src`). The origin
is derived from `fleet/ui/webfonts.ts`'s catalog so it is spelled once. Browsers only reach Collie
through the Gateway: Collie binds loopback, the reverse proxy targets the Gateway, and the deploy
check reads both listeners.

### 6. The Bun floor (B5)

Measured before the merge: on Bun 1.4.0 a direct `AbortSignal.timeout` keeps firing after its last
listener is removed, with fake timers and on the real clock. After the merge, upstream's
`createSttDeadline` is run against the fork's three deadline scenarios, `bridge/stt/provider.test.ts`
and `bridge/stt/codex.test.ts` on 1.4.0. If they pass, the port and `fleet/stt-deadline.ts` go, the
scenarios stay as a fork-owned test under `fleet/`, and the floor is 1.4.0 in `docs/herdr-fleet.md`;
otherwise the port stays and the floor is 1.4.2. Every current member already runs a Bun at or above
1.4.0, so the floor asks nothing of the operator.

### 7. Offline cold start (B6)

The fork's navigation route stays first and network-first. On a rejected `fetch` (no network), and
only for a navigation outside upstream's network-only denylist (`navigationNetworkOnlyUnder`), it
answers with the precached `index.html`. Any response is returned untouched and nothing is put in a
cache. The precached shell is the build's own file, fetched at install, and carries no protected
data; what 1.18 shows offline is its own IndexedDB store (ADR 0087), which is upstream behaviour.

### 8. Overlaps

- **Dashboard control bar** (upstream d7a323c3): the route-column content; the rails are unchanged and
  read neither the workspace select nor the order select (`fleet-native-navigation-sidebars`).
- **Left-hand layout and Send now**: the fork's record control stays its own control beside Send and
  mirrors with upstream's hand setting (`fleet-composer-voice` delta). Send now lives in Chat's
  waiting card and does not touch the composer's controls.
- **Redaction**: the bridge masks pane text it serves. The fork's terminal surface streams the real
  terminal through `herdr terminal attach`, which never passes through the bridge, so it is not
  masked. That is by construction: it is the terminal itself, behind the same Gateway session that
  can type into it.
- **Disconnect badge**: 1.18 draws it on the Collie mark, which the Pane route declines; the fork
  draws the same badge in the leading slot there (`fleet-pane-chrome` delta).

### 8a. The terminal surface keeps its Pane live

Collie 1.18 adds per-pane liveness (`lib/liveness.ts`, M46 spec 11): a Pane is live while its last
read succeeded, only the mirror's read (`fetchPane`) marks it, and a Pane that is not live loses the
⋮ sheet's Rename, Close and Focus and the tab strip's writes, as on a saved copy. The terminal surface
reads no mirror, so its Pane would never be live. The fork-owned `fleet-terminal.tsx` marks the Pane
live through upstream's `markLive` when its stream opens and every 30 seconds while it stays open
(inside upstream's 90-second cap), and `markDead` when it closes. Found by the fork's
`fleet-pane-route` case, which asserts Rename under the terminal surface.

### 9. Open for the owner

- Collie's Settings card offers a pair form, and its connection card reports "not paired", in a
  browser behind the Gateway (decision 1). Both are cosmetic; a pair attempt is refused.
- After a logout an offline device can still show 1.18's saved copy of the herd for up to its 24-hour
  lifetime. Online, the Gateway decides every navigation.
- Collie's `/settings/updates` page keeps upstream's reading column, which predates this adoption;
  `fleet-native-navigation-sidebars` says every Settings page fills the route column. Not changed here.

### 9a. Entry review against `v1.18.0`

Every entry's anchors were re-read in the merged tree and its bun and vitest `verify` files run
(browser tier excepted). `reviewed = "v1.18.0"` is set on all 29 remaining entries. One entry was
dropped, none added. `bun run test:fork`: 871 owned / 94 invasive paths before, 892 owned / 86
invasive after.

| entry | decision | reason |
| --- | --- | --- |
| `native-row-actions-menu-port` | keep | the strips auto-merged |
| `unnarrowed-pack-rows-port` | keep | the loaders auto-merged beside 1.18's saved-copy loaders |
| `repository-guidance` | adapt | symlink kept; the agreement states `ft()` and the Gateway's pairing |
| `fake-network-fleet-routes` | keep | Fleet's 404s beside upstream's new handlers |
| `lint-parse-boundary` | adapt | the fork's files in their own override block (B4) |
| `plugin-identity` | keep | only the version line conflicted |
| `downstream-version-line` | keep | `COLLIE_CHANGELOG.md` is `v1.18.0`'s file verbatim, no seam |
| `fleet-build-port` | keep | only the version line conflicted |
| `native-agent-favorites-port` | adapt | the seven dictionaries leave the entry (B1) |
| `pane-surface-route-port` | adapt | the terminal surface keeps its Pane live (decision 8a) |
| `native-pane-content-port` | keep | `renderContent` beside 1.18's saved-copy props |
| `authenticated-navigation-cache` | adapt | shell fallback on network failure (B6); 1.18's worker source test reads the fork's route |
| `native-manual-pane-fit-port` | keep | the Display slot is untouched |
| `native-pane-page-port` | adapt | saved-copy Chat read behind `chatOffered`; fold control still absent |
| `crew-focus-audit-name-port` | keep | `pane.focus` namespacing intact |
| `declined-centred-history-column` | keep | history width unchanged upstream |
| `native-navigation-sidebars-port` | adapt | the shell wraps 1.18's header host; rails reserve the inset; smoke heading scoped to main; owned duplicates removed (B2) |
| `native-pane-chrome-port` | adapt | `paper` beside `online`/`lastSeenAt`; the lost badge on a declined mark |
| `native-webfont-port` | adapt | `bridge/server.ts` back to upstream (B3); the Maple note through `ft` |
| `private-fact-guard-port` | keep | the hook is untouched upstream |
| `composer-voice-rank-port` | adapt | left-hand mirroring; offline refuses the record control; `ft` refusals |
| `fork-gate-in-ci` | keep | step and fetch depth intact |
| `no-automatic-release-publication` | keep | trigger is still `workflow_dispatch` only |
| `upstream-removal-clock` | keep | reads `v1.18.0` |
| `downstream-docs` | keep | the exclusion is unchanged |
| `codex-headless-status-row-port` | keep | `codex/markers.ts` untouched upstream; the headless row is still unread |
| `stt-deadline-runtime-port` | **drop** | upstream's deadline holds on Bun 1.4.0 (B5) |
| `stable-table-corpus-test` | keep | sorted listing intact |
| `terminal-binding-pin-port` | adapt | `bindingSession` beside the repo lookup; `gitHead` in both baselines |
| `host-workspace-form-port` | adapt | `fixedHost` beside `branchOff` |

### 10. Release axis: MINOR, 3.12.0 → 3.13.0

An adoption is at least MINOR and every member executes the new bridge. Not MAJOR: no configuration
key, enrolment step, state file or contract changes, and pairing needs no operator action.

## Risks / Trade-offs

- [The registry holds the Gateway's hash while Fleet runs] → a 1.17 Collie started against it would
  switch its write gate on; the clean stop revokes it, and a crash is repaired by the next start.
- [A browser behind the Gateway is shown as unpaired in two Settings cards] → recorded, decision 9.
- [Fork strings read English in five languages] → the fork never had them; recorded as a non-goal.

## Migration Plan

Level the lead first, then each member. No configuration edit, enrolment step or state rename. A lead
rollback is a plain redeploy of the previous release; its clean stop has already emptied the Gateway's
entry from the registry.
