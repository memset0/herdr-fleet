## Context

See proposal.md — Why. The ground as read before anything was changed (all read-only):

```
baseline  v1.5.2  tag 38798351…  commit cea2035e…   (FORK.toml [upstream]; = merge-base HEAD v1.8.2)
target    v1.8.2  tag 5bfd5b97…  commit 78f74d1e…   236 commits, 562 files
preflight (simulated with renames counted): 20 of 21 invasive entries disturbed,
          1 untouched (authenticated-navigation-cache), no owned path occupied
```

The preflight as it stands lists the same 20 entries, but it is right by accident: its
`git diff --name-only` runs with Git's default rename detection, which prints only the destination of
a rename, so a declared path that upstream moved is dropped from the entry's list. Four declared paths
are affected — `bridge/pack/forward.ts`, `bridge/pack/forward.test.ts`, `PACK_PROTOCOL.md`
(`native-manual-pane-fit-port`) and `web/src/routes/pack.tsx` (`native-navigation-sidebars-port`).
Both entries happen to be disturbed through other paths, so no entry is lost this time; the next
rename of a single-path entry would be.

`git merge-tree --write-tree --name-only HEAD v1.8.2` predicts 23 conflicted paths, every one inside a
declared entry (two of them under the name upstream renamed the declared path to):

| conflicted path | entry |
| --- | --- |
| `.gitignore`, `CLAUDE.md` (distinct types) | `repository-guidance` |
| `.oxlintrc.json` | `lint-parse-boundary` |
| `CHANGELOG.md`, `web/package.json` | `downstream-version-line` |
| `herdr-plugin.toml` | `plugin-identity` |
| `package.json` | `fleet-build-port` |
| `scripts/git-hooks/pre-commit`, `scripts/pre-commit.test.sh` | `private-fact-guard-port` |
| `docs/voice-and-push.md` | `composer-voice-rank-port` |
| `web/src/components/agent-list.test.tsx` | `native-agent-favorites-port` |
| `web/src/components/app-header.tsx`, `web/src/routes/root.tsx` | `native-navigation-sidebars-port` |
| `web/src/lib/loaders.ts` | `unnarrowed-pack-rows-port` |
| `CREW_PROTOCOL.md` (declared as `PACK_PROTOCOL.md`), `bridge/crew/forward.test.ts` (declared as `bridge/pack/forward.test.ts`), `bridge/index.ts`, `bridge/mux/herdr/adapter.ts`, `web/src/components/agent-chat.tsx`, `agent-chat.test.tsx`, `composer.tsx`, `display-prefs.tsx`, `web/src/lib/api.ts` | `native-manual-pane-fit-port` |

Upstream's `v1.8.x` compatibility window, from `CREW_PROTOCOL.md` §0–§0.1, `docs/crew.md` → *Updating
from 1.7.0* and the changelog:

- Wire: `/pack/v1/*` → `/crew/v1/*`; `X-Pack-*` → `X-Crew-*`; `CREW_PROTOCOL_VERSION = 2`; signing
  contexts `collie-crew-{warrant,dial}-v2`; error codes and JSON fields say crew; `packId` is written
  `crewId` and read either way.
- Overlap, removed in `v1.9.0`: a `v1.8` node answers `/pack/v1/*` in the version 1 shapes through
  the same handlers (a generic prefix translation), and a `v1.8` dialler tries `/crew/v1/*` first and
  falls back to `/pack/v1/*` once per dial when the far side answers with a version 1 header, or with
  an answer that is neither a crew answer nor JSON (`200 text/html`, `404`, `403`; never a `5xx`). A
  warrant minted by a `v1.8` lead is refused by a `v1.7`-or-older member until it levels.
- Environment: `COLLIE_CREW_TIMEOUT_MS` / `COLLIE_CREW_HELLO_TIMEOUT_MS`; the `COLLIE_PACK_*` pair is
  read while the new key is absent, with one warning line at start.
- State: `pack-trust.json`, `pack-ops.json`, `pack-runtime.json` are renamed (not copied) to `crew-*`
  on Collie's first start, by the bridge's boot and by Collie's own state-opening commands, never by
  the trust-store reader itself. If both names exist the new one wins.
- Other names: journal prefix `[crew]`; census `/api/crew` (`/api/pack` answers 308 for one release);
  web route `/crew` (`/pack` redirects until upstream's 2.0.0); `collie pack` stays an alias; hook
  hatch `SKIP_CREW_WIRE_CHECK`; `bridge/pack/` → `bridge/crew/`, `cli/pack*.ts` → `cli/crew*.ts`,
  `web/src/components/pack-*.tsx` → `crew-*.tsx`, `web/src/lib/update-pack.ts` → `update-crew.ts`,
  `web/src/routes/pack.tsx` → `crew.tsx`, `scripts/check-pack-wire.sh` → `check-crew-wire.sh`,
  `PACK_PROTOCOL.md` → `CREW_PROTOCOL.md`; every `Pack…` identifier and `pack.*` translation key.

## Goals / Non-Goals

**Goals:**

- A preflight whose report can be trusted across renames, before it is used on this release.
- `v1.8.2` in this history as real ancestry; every port reviewed; the fork's own code on crew
  naming and protocol version 2 with no behavior of its own lost across the overlap.
- A release that members on the current 3.3.x line can level to in either order during the overlap.

**Non-Goals:**

- Renaming this fork's own vocabulary (configuration section, entry ids, capability names, module
  and error-text names). That is an owner decision for a later change, and the configuration key
  rename in particular would sit on the MAJOR axis.
- Any member deployment, and any edit to the operator's deployment tooling (listed below for them).

## Decisions

### 1. The preflight counts both sides of a rename, independent of Git configuration

`preflightInput` replaces `git diff --name-only <baseline> <target>` with one explicit
`git diff --name-status --find-renames <baseline> <target>`, parsed by a pure function that returns
the changed set (the source AND the destination of every `R` row, plus every `A`/`M`/`D`/`T` path)
and a rename map `source → destination`. Passing `--find-renames` explicitly overrides
`diff.renames`, so the output is the same on every machine; a rename below the similarity threshold
arrives as a deletion plus an addition, which is counted on both sides anyway. `PreflightEntry` gains
the destinations of its moved paths and the CLI prints `declared → destination` for each.

Alternatives: `--no-renames` alone fixes the blindness in one flag but throws away the destination,
which is exactly what the reviewer needs to re-point `FORK.toml`; reusing `parseGitChanges` as is
loses the pairing. The non-target mode already runs `--find-renames` through `parseGitChanges` and
counts both sides, so it is unchanged.

Tests: (a) the pure parser over `R074\tbridge/pack/forward.ts\tbridge/crew/forward.ts` and mixed rows;
(b) `planUpstreamAdoption` reports an entry declaring only a renamed path as disturbed and names the
destination; (c) one sandboxed-repository test that builds a baseline commit, an annotated target tag
that renames a declared file, and runs `preflightInput` with `diff.renames` set to `false`, `true` and
unset — the defect lived in the Git invocation, which a pure test would not have caught. The sandbox
isolates global and system Git configuration and needs no network.

### 2. The merge is real, made on `main`, resolved from the entry that predicted each conflict

`git merge --no-ff --no-commit v1.8.2`, verify `MERGE_HEAD` is `78f74d1e…`, resolve, commit only
after every gate. Upstream's file is the base and the port is re-applied on top. Contracts:
`CLAUDE.md` stays the relative symlink (upstream's regular file is not read into it); `CHANGELOG.md`
stays ours with one Unreleased line; version files keep `3.3.0` until the release commit;
`herdr-plugin.toml` keeps this product's identity; `COLLIE_CHANGELOG.md` becomes `v1.8.2`'s changelog
verbatim with no seam (all 67 retained release headings are present among `v1.8.2`'s 76).

The check-fork fix is its own earlier commit. The merge commit records the merge and its conflict
resolution only, and the fork-side migration (decision 3) follows it as its own commit on `main`
(owner's phasing, 2026-09-30): the merge commit knowingly does not typecheck where fork code still
imports `bridge/pack/*`, and nothing is released or pushed between the two. This keeps the merge's
conflict resolution reviewable apart from the fork's own rename work; the second parent is still
exactly `78f74d1e…`.

This change's planning artifacts are committed on their own, as planning-only work, before the
preflight runs, because the preflight refuses untracked paths. The two parked changes were moved out
of the tree by the owner for the duration of the adoption. The owner authorized proceeding with this
change active, so the preflight runs with `--allow-active-changes`.

### 3. The fork follows upstream's names where they are upstream's, and keeps its own

Mandatory, because upstream moved the thing the fork imports or calls:

| fork file | change |
| --- | --- |
| `fleet/pack-authority.ts` (+test) | imports `bridge/crew/{mode,trust-store,fixtures}`; trust reader per decision 4 |
| `fleet/pack-enrollment.ts` (+test) | `CREW_PROTOCOL_VERSION`, `CREW_ENROLL_PATH`, `bridge/crew/*`; `crewId`/`crew` in the stored data; Collie's one-time state move before the store opens |
| `fleet/config.ts` | `isMemberId` from `bridge/crew/identity.ts`; comment names `COLLIE_CREW_TIMEOUT_MS` |
| `fleet/collie-env.ts` (+test) | reset `COLLIE_CREW_TIMEOUT_MS` **and** `COLLIE_PACK_TIMEOUT_MS`; set only the crew key |
| `fleet/gateway.ts` (+test) | deny `/crew/` as well as `/pack/` (decision 5) |
| `fleet/main.test.ts`, `fleet/main.ts`, `fleet/pack-reachability.ts` | `bridge/crew/trust-store.ts`; `CREW_PROTOCOL.md` section references |
| `fleet/manual-pane-fit/capability.test.ts` | `crewRouteFor` from `bridge/crew/forward.ts`; add the resize overlap assertions (decision 6) |
| `web/src/components/fleet-row-actions.tsx`, `native-navigation-tree.tsx` (+tests), `native-agent-rail.test.tsx`, `fleet-command-bar.test.tsx` | `useCrew`/`CrewProvider`/`useHostWriteBlock` from `crew-provider` |
| `web/src/lib/loaders.ts` (port lines), `web/src/lib/api.ts` (port lines) | `fetchCrew`/`/api/crew` and the renamed status type in the version-evidence port |
| `bridge/crew/forward.ts`, `forward.test.ts`, `CREW_PROTOCOL.md`, `bridge/index.ts` | the resize port re-applied on the crew router and documented on `/crew/v1/pane/:id/resize` |
| `docs/herdr-fleet.md` | `CREW_PROTOCOL.md` §8.2 and `/api/crew` |
| `AGENTS.md` | references the rename made false: `CREW_PROTOCOL.md`, `/crew/v1/*`, `bridge/crew/`, `scripts/check-crew-wire.sh`, `SKIP_CREW_WIRE_CHECK`, `crew-ops.json`, and the renamed version constant at the members paragraph. Upstream's new working-agreement text is not imported wholesale (precedent of both earlier adoptions); only a rule that governs a tool this repository now runs — the browser tier — gets its one-line form here |
| `FORK.toml` | path renames in decision 7 |

Kept: the private configuration's `[pack]` section and its keys, `FORK.toml` entry ids (including
`unnarrowed-pack-rows-port`), the `fleet-pack-*` capability names, fork module file names and
symbols (`validatePackAuthority`, `FleetNativePackConfig`, `fleetTestPack*`), and operator-facing
error texts. They are this product's own vocabulary; renaming them buys nothing on this release and
the configuration key would cost a MAJOR.

### 4. Trust state is read under the current name, with a read-only fallback, and never migrated by the runtime

Fleet validates authority before it spawns Collie, and upstream's rename happens in Collie's boot, so
on the first start after the upgrade only `pack-trust.json` exists. Reading only the new name would
fail closed and Collie would never start to perform its own rename. The fork's production reader
therefore reads `crew-trust.json` through Collie's reader when it exists, else parses the legacy file
read-only through Collie's own parser, and never renames. Calling upstream's `migrateCrewStateOnce`
from the runtime was rejected: the authority spec forbids the runtime from migrating trust state,
and a reader-side fallback keeps that line intact.

Found during apply: upstream's default filesystem io (`fsTrustStoreIo`) itself runs
`migrateCrewStateOnce` before every read and write, so `new TrustStore(stateDir).load()` would rename
the operator's file from inside Fleet's validation. The production reader therefore constructs
Collie's `TrustStore` with a fork-owned read-only `TrustStoreIo` (`readOnlyTrustStoreIo`): it reads
the current name, else the previous name taken from Collie's own `crewStateFileMoves()` table, never
renames and refuses every write. Parsing, the solo/invalid warning and mode derivation stay Collie's.
A mutation check (swapping in the default io) fails the legacy-only test, which is what proves it.

Enrolment is an explicit operator act that opens the store for writing, which is exactly where
upstream itself runs the move (its CLI deps builders). Fleet's enrolment calls upstream's
`migrateCrewStateOnce(stateDir, warn)` before constructing the store, so it cannot create a second
trust store beside a legacy one. Enrolment across protocol versions is not supported by Fleet's
client, which has no fallback of its own: enrol a member after the lead runs the new release.

### 5. The Gateway denies the crew link prefix

`fleet/gateway.ts` denies `startsWith("/pack/")`; the adopted Collie serves the link on `/crew/v1/*`
too, so without a change the public Gateway would forward an authenticated browser's request for a
link path to Collie. The rule becomes `/crew/` or `/pack/`, which leaves the `/crew` page (no
sub-routes upstream) and the `/pack` redirect reachable. Security-relevant; covered by gateway tests.

### 6. Manual Pane fit rides upstream's per-host capability and its overlap

`bd3adc5f` (v1.7.0, "each machine in a crew answers for its own multiplexer") makes every member
report its own capability table and the lead answer `/api/config?host=` from it; `resizePane` is
already in the capability table, so a member now reports its own answer. The fork's call site must
pass the Pane's scope (`useMuxCapability("resizePane", scope)`, as upstream now does for `sendKeys`)
or a tmux/zellij member would show Resize from a Herdr lead's answer. A member that reports nothing
keeps the lead's answer, which is 3.3.x members' behaviour.

The `bridge/mux/herdr/adapter.ts` conflict itself is one line: the fork's `viewportRows` capture and
upstream's `pane.revision = raw.revision` (`198fe204`) both land in the same `if (raw.scroll)` block;
keep both.

The resize route is re-applied on the crew router (`/crew/v1/pane/:id/resize`, `X-Crew-Protocol: 2`)
and documented in `CREW_PROTOCOL.md`. Upstream's overlap translates prefixes generically
(`version1PathFor` / `version2PathFor`), so a new lead reaches a 3.3.x member at
`/pack/v1/pane/:id/resize` through the fallback, and a new member answers a 3.3.x lead's
`/pack/v1/pane/:id/resize` through the version 1 mount — provided the route is in the crew router's
table and the forward/route correspondence check. The fork asserts both directions in its own
`fleet/manual-pane-fit/capability.test.ts` rather than adding cases to upstream's `router.test.ts`,
which would be a new invasive path.

### 7. `FORK.toml` follows upstream's renames

`native-manual-pane-fit-port`: `bridge/pack/forward.ts#resize` → `bridge/crew/forward.ts#resize`,
`bridge/pack/forward.test.ts#paneActionsDeclaredIn` → `bridge/crew/forward.test.ts#<anchor that
survives>`, `PACK_PROTOCOL.md#/pack/v1/pane/:id/resize` → `CREW_PROTOCOL.md#/crew/v1/pane/:id/resize`,
and the verify entries. `native-navigation-sidebars-port`: `web/src/routes/pack.tsx#…` →
`web/src/routes/crew.tsx#…`. `fleet-runtime` owned verify list: `bridge/pack/forward.test.ts` →
`bridge/crew/forward.test.ts`. Every `reason` that names a renamed file is corrected; `reviewed`
moves to `v1.8.2` on all 21 entries after each has its decision and its `verify` list has passed.

### 8. Composer and microphone ports

Upstream `v1.6`–`v1.8` touched the composer only around the microphone, never the slot decision this
fork reverses (`abdbf45`): the attachment button became an anchored menu with a pressed tone
(`9833ba3f`, `9fa55a72`, `ffd89b09`, `495b9c79`, `ATTACH_PRESS_MS` next to the fork's
`MIC_REFUSAL_MESSAGES`); a *Full latest reply* display row (`46d2fe6a`) adds `setExpandClippedReply`
and `expandClippedReply` to the composer, `display-prefs.tsx` and the `composer-stt.test.tsx` fixture,
colliding with the fork's `displayPrefsAfterTextSize`/`afterTextSize` slot; capability hooks take the
Pane's scope (`bd3adc5f`); and the crew rename. `docs/voice-and-push.md` was restructured "command
first" (`dcb37438`). Resolution: take upstream's composer and re-apply the fork's split record/Send
controls, mic refusal table, keyboard-command registration, status-word/host switches and Display
slot; keep both display props, with `Resize` still directly below `Text size`; keep the fork's
paragraph in the voice doc inside upstream's new structure. `composer-voice-rank-port`'s suite and
`fleet/ui/mic-commands.test.ts` decide; `composer-stt.test.tsx` auto-merges and must still pass.

### 9. Release axis: MINOR, 3.3.0 → 3.4.0

`AGENTS.md`: *"The axis is how far the change has to travel — which machines must redeploy before
the fleet is consistent again."* MINOR: *"every other member redeploys too. Anything a peer executes
— the supervisor, the pack link … — is half deployed while one member still runs the old code."*
MAJOR: *"the operator changes something that is not code — a configuration key renamed or removed, a
contract broken, an enrolment step, a workflow that worked and now doesn't."* `fleet-upstream-sync`
sets the floor: *"An adoption is released, and the release is at least a MINOR"*, and says an agent
that finds a renamed configuration key or a changed operator step stops.

The link changes, so every member redeploys: at least MINOR. It is not MAJOR on the forward path:
Fleet's configuration is unchanged (the `[pack]` section stays), the renamed environment key is
projected by Fleet itself with both spellings reset, the state files are moved by Collie
automatically, enrolment is unchanged, and upstream's overlap keeps 3.3.x members and a 3.4.0 lead
working in both orders for this release. **Recommendation: 3.4.0.**

What would move it to MAJOR, and must be re-assessed at the release task: renaming the configuration
section; or the owner treating either deployment-side consequence below — the census path the
operator's tooling polls, and a rollback across the state rename — as "a workflow that worked and now
doesn't". The first is covered for this release by the 308; the second is a real asymmetry (a
previous release started against migrated state fails closed on a missing trust store). If the owner
reads either as MAJOR, the agent stops and the owner cuts the release by hand.

**Owner decision (2026-09-30): MINOR, 3.3.0 → 3.4.0.** The rollback asymmetry is accepted as a
deployment-side obligation rather than a broken workflow: rolling 3.4.0 back to 3.3.x after 3.4.0 has
started requires renaming Collie's `crew-*.json` state files back to their `pack-*.json` names. The
3.4.0 changelog entry states that obligation in its wording, beside the redeploy-every-member note.

### 10. Archive waits for the members (owner-confirmed)

The push ends this repository's part, but a push is not a completed adoption, and this one exists to
be proven on the members before `v1.9.0`. The change is archived after the operator reports every
member running 3.4.0 through the new link, so a defect a member exposes is answered by the next minor
while the decision record is still open.

### 11. Changelog entries take upstream's bold-lead shape (coordinator decision, 2026-09-30)

Upstream's `v1.8` pre-commit hook refuses any `## [Unreleased]` bullet that does not open with a bold
lead sentence, because upstream's `scripts/release-notes.ts` prints those leads on a GitHub Release
page. This product publishes no GitHub Releases, and every Unreleased line it carried failed the
check. Decision: **adopt the shape, leave the hook as upstream ships it.** `AGENTS.md`'s changelog rule
now requires each entry to open with a short bold lead sentence — still one entry per line, still Keep
a Changelog, now with upstream's `### Packaging` and `### Docs` groups allowed — and every existing
Unreleased entry was reshaped in its own doc-only commit before any functional commit of this change.

Alternative rejected: porting the hook to drop the shape check. It would add a declared change to the
`private-fact-guard-port` entry's hook for a rule that costs this product nothing to follow, and every
later adoption would have to re-apply it.

### 12. Entry review against `v1.8.2` (task group 7)

Every entry's anchors were re-read in the merged tree and its `verify` list run; none was dropped, so
no path returned to upstream's version. `reviewed = "v1.8.2"` on all 21.

| entry | decision | reason |
| --- | --- | --- |
| `native-row-actions-menu-port` | keep | strips still import one drop-in each; the sheets are untouched upstream |
| `unnarrowed-pack-rows-port` | adapt | version evidence reads the crew census via `fetchCrew`; reason corrected |
| `repository-guidance` | adapt | upstream now makes `CLAUDE.md` canonical; the fork keeps `AGENTS.md` canonical and the symlink |
| `fake-network-fleet-routes` | keep | Fleet routes still unknown to upstream's MSW handlers |
| `lint-parse-boundary` | keep | same override class, no rule changed |
| `plugin-identity` | keep | Herdr still reads identity and actions only from the manifest |
| `downstream-version-line` | adapt | changelog lines now take upstream's bold-lead shape (decision 11); reason notes it |
| `fleet-build-port` | keep | root test and typecheck gates still owned upstream |
| `native-agent-favorites-port` | keep | rows still expose only favorite ports; dictionaries still one entry |
| `pane-surface-route-port` | keep | router still owns the Pane route; drop-ins unchanged |
| `native-pane-content-port` | keep | detail frame unchanged in shape; body slot still narrower than a copy |
| `authenticated-navigation-cache` | keep | upstream still serves navigations from the precache outside a denylist; the fork's network-first route supersedes it, version 1 line included |
| `native-manual-pane-fit-port` | adapt | route moved to the crew router and `CREW_PROTOCOL.md`; capability asked per Pane Host; reason corrected |
| `declined-centred-history-column` | keep | owner decision of 2026-09-05 stands; upstream's ladder not adopted |
| `native-navigation-sidebars-port` | adapt | `web/src/routes/pack.tsx` re-pointed to `crew.tsx`; ports unchanged |
| `native-pane-chrome-port` | keep | strips-summary trailing slot and mark ground still the narrowest ports |
| `native-webfont-port` | keep | one `var()` hole per stack still suffices |
| `private-fact-guard-port` | adapt | re-lettered guard E beside upstream's new flake.lock guard D; intent and reason corrected |
| `composer-voice-rank-port` | keep | two-button split still reverses `abdbf45`; voice doc paragraph kept in upstream's new structure |
| `fork-gate-in-ci` | keep | one step in upstream's CI beside its new e2e job |
| `no-automatic-release-publication` | keep | upstream still publishes on tag push; this product publishes nothing |

### 13. Phase C2 boundary decisions (coordinator decisions, 2026-09-30)

Phase C's full suites on a designated member and the local browser tier found eight upstream-added
test cases that meet declared fork ports (two `cli`, three web vitest, three Playwright) plus one
real defect in a fork-owned component; a ninth (Playwright) surfaced once the serial group it sits
in ran past the stuck-guard case. Each is settled at the boundary, not by weakening an upstream
assertion about upstream's own surface:

| finding | decision | where |
| --- | --- | --- |
| `cli/program.test.ts` "the `crew` alias is gone in 2.0.0" read this product's 3.x as Collie's major | the removal clock reads Collie's release | new entry `upstream-removal-clock` |
| `cli/docs-embed.test.ts` expects every `docs/*.md` in the binary's registry | exclude the fork's own page from the test's disk listing | new entry `downstream-docs` |
| `web/src/routes/root.test.tsx` ×2: four top-inset reservations instead of one | count the app's own column; the rails and the drawer are accounted for separately | `native-navigation-sidebars-port` |
| (defect behind the count) the rails kept reserving the inset while the strip band was open | `Rail` reads `useStripBandOpen()` as the header does | fork-owned `native-navigation-shell.tsx` |
| `web/src/playground/sections/motion.test.tsx`: `/ARCHITECTURE/` matched twice | look inside the route's `main` | `native-navigation-sidebars-port` |
| `web/e2e/smoke.spec.ts` (phone, tablet): first `webapp` match is the hidden Herds rail | look inside the route's `main` | `native-navigation-sidebars-port` |
| `web/e2e/service-worker.spec.ts` "the stuck guard reloads onto A" (phone) | skipped: network-first navigation by design | `authenticated-navigation-cache` |
| `web/e2e/service-worker.spec.ts` "a manual reload during the install still comes back to a booted app" (phone; did not run in phase C, timed out once the case before it was skipped) | skipped for the same reason (extension of the coordinator's decision, same entry and reason) | `authenticated-navigation-cache` |
| `scripts/release-notes.test.ts` (Unreleased/[3.3.0] bullets lack bold leads) | no action; the `3.4.0` section satisfies it after the bump | — |

**Removal clock.** Upstream has no shared reading point: each of the two scheduled-removal tests
reads `../package.json` itself (`program.test.ts` the major, for the `collie pack` alias at 2.0.0;
`removal-schedule.test.ts` the minor, for the protocol version 1 overlap at 1.9.0). The smallest
common port is therefore one imported name in each: a fork-owned `fleet/upstream-version.ts` reads
`FORK.toml`'s `[upstream].tag` through the manifest's own validating parser
(`scripts/fork-manifest.ts`) and returns `{ major, minor, patch }`, throwing on anything but a strict
`vX.Y.Z` so an unreadable clock fails the suite rather than switching every check off. Both files
import `upstreamVersion()` in place of their package.json read; every removal assertion and threshold
stays upstream's. Anchors: `cli/program.test.ts#upstreamVersion()`,
`bridge/removal-schedule.test.ts#upstreamVersion()`. This also retires the future misfire recorded
below (removal-schedule reading a Fleet 3.9 as Collie 1.9): the clock now reads 1.8 until the
adoption that crosses 1.9.0 moves the tag, which is exactly when upstream intends it to fire. The
fork-owned `fleet/upstream-version.test.ts` pins the read (it equals the manifest's tag, it follows
a moved tag in a copied manifest, it refuses malformed tags) and that both upstream clocks call it.
Rejected: returning `package.json` to Collie's number (breaks this product's version rule) and
skipping the two checks (loses upstream's removal reminders).

**Docs registry.** Embedding `docs/herdr-fleet.md` would need an edit to `cli/docs-embed.ts` — a
hand-written import list, not a glob, in an upstream file no entry declares — and would change what
the `collie` binary prints (`collie docs`, and the table `collie skill` hands to agents) for a page
about the Gateway and the Pane terminal surface, which that binary does not serve. The test-side
exclusion costs the same single invasive path (`cli/docs-embed.test.ts#herdr-fleet.md`) and changes
no shipped behavior, so it is the narrower port. It gets its own entry `downstream-docs` because
`fleet-runtime` is an owned entry and cannot carry an anchored upstream path.

**Rails and the notch.** The strip band sits above `NativeNavigationShell` and spans every column,
and the header yields the top inset to it while it is open. The rails did not, so under an open band
each rail's title stood an inset lower than the header beside it — the defect upstream's
whole-layout count exposed. `Rail` now uses `useStripBandOpen()` with the header's 240ms padding
transition; the drawer keeps its unconditional reservation because it is a `fixed inset-0` layer
over the band, like upstream's sheet primitive. The fork-owned shell test asserts both states (band
open: no rail reservation and the drawer's own; band empty: one per rail) and was mutation-checked
against the old rule. Upstream's count in `routes/root.test.tsx` then counts only the app's column
by excluding elements inside the shell's `aside` rails and `#fleet-hierarchy-overlay`
(anchor `fleet-hierarchy-overlay`); its "exactly once" and "band, not header" assertions are
unchanged.

**Duplicate rows.** The Agents rail lists the same pane as the space route and the Herds rail names
the same workspace as the dashboard, so upstream's text queries found the rail's copy first (hidden
below the rail breakpoint in the browser; present in jsdom). `motion.test.tsx` and `e2e/smoke.spec.ts`
look inside the route's `main` region instead (anchors `within(within(card).getByRole("main"))`,
`page.getByRole("main").getByText`).

**Stuck guard.** The case asserts the guard's reload lands on the precached build A and that only a
second tap escapes it. `authenticated-navigation-cache` answers every document navigation
network-first, so that reload reaches the server and lands on B; the wedge the case pins cannot form
here. The case alone is skipped at its first line with the reason `network-first navigation by
design` (anchor of the same text). Of the two cases after it that did not run in phase C, "a tap
while build B is still installing never reloads onto build A" passes; "a manual reload during the
install still comes back to a booted app" rests on the same premise — the reload is answered from
the old worker's precache — and timed out: under network-first navigation the reload takes build B's
shell from the server and then waits for B's 1.3 MB entry chunk through the case's 8 KB/s throttle,
which the case releases only after the reload (about 160 s against a 120 s budget). No entry script
404s; the page is waiting for the new build rather than showing the old one, which is the accepted
cost of that entry (a reload during a slow install is as slow as the link). It is skipped with the
same reason, under the same entry and anchor. The browser tier is new since `v1.5.2`, so neither
case has a pre-merge baseline.

**Release notes.** `scripts/release-notes.test.ts` fails today only because `CHANGELOG.md`'s newest
numbered section (`[3.3.0]`) predates the bold-lead shape. The `3.4.0` release commit makes the
Unreleased lines (all bold-lead, decision 11) the newest numbered section, so the release group must
re-run this test after the bump and expect it to pass; it is not a boundary question.

**Manifest.** Two new invasive entries (`upstream-removal-clock`, `downstream-docs`) and two
extended ones (`native-navigation-sidebars-port`, `authenticated-navigation-cache`), all
`reviewed = "v1.8.2"`, so the manifest now holds 23 invasive entries; `fleet/upstream-version.test.ts`
joins `fleet-runtime`'s verify list (`fleet/**` already owns both new files).

**Results (tasks 8.2 and 8.3).** On a designated member, re-run for the suites these edits touch:
`bun test ./cli` 1405 pass / 0 fail, `bridge/removal-schedule.test.ts` 16 / 0, `bun test ./fleet`
590 / 0, web vitest 216 files, 5885 pass / 30 todo / 0 fail; every other phase C suite was already
green and is untouched. Locally the full web vitest matches that count, and the browser tier
(`bun run e2e`) is 43 passed / 11 skipped / 0 failed: nine are upstream's own phone-only skip of the
service-worker file on `app-tablet`, and two are the declared network-first skips above. The one
remaining unit failure, `scripts/release-notes.test.ts`, clears with the `3.4.0` bump (above). The
`bridge/stt/codex` and `openai` hangs stay with `fix-stt-test-exit`, unchanged by this adoption.

**Follow-ups (out of scope here).** Device-name fixtures in `web/src/lib/fleet-roster.test.ts` and in
archived changes are to be replaced with reserved example names in a separate change opened right
after the 3.4.0 release; this change does not touch them.

## Risks / Trade-offs

- [Rollback across the state rename] → a previous release started after 3.4.0's Collie has run finds
  no `pack-trust.json` and fails closed. Upstream keeps no copy on purpose (a second store is a second
  roster). The fork does not undo that; the deployment side restores the names (below).
- [A dirty tree blocks the preflight] → the two parked, untracked change directories made the tree
  dirty and the preflight refuses by design. The rule is not relaxed: the owner moved both out of the
  tree for the duration, and this change is committed as planning-only work before task 2.
- [Full suites and the known web-suite exit nondeterminism] → an unrelated parked change owns that
  defect; the full suites run on a designated member and a failure is triaged against the pre-merge
  baseline rather than papered over.
- [Upstream's browser tier asserts upstream's layout] → cases may fail against the fork's shell. A
  failure inside a declared port is fixed in the port or reported; rewriting an upstream e2e case is
  a new invasive path and needs its own entry and reason.
- [`bridge/removal-schedule.test.ts` read the package minor] → it read this product's version, not
  Collie's, and would have misfired at a Fleet 3.9 before the `v1.9.0` adoption. Resolved in phase
  C2 (decision 13): both removal clocks read `FORK.toml`'s `[upstream].tag`.
- [Fleet enrolment has no cross-version fallback] → enrol only after the lead runs 3.4.0.

## Known follow-ups

Recorded here, not fixed by this change unless the fix turns out to be trivial:

- ~~Upstream's `bridge/removal-schedule.test.ts` reads this product's `package.json` minor as if it
  were Collie's~~ — resolved in phase C2 by `upstream-removal-clock` (decision 13).
- Upstream's Playwright browser tier met the fork's shell in two cases; both are now declared ports
  (decision 13). A later adoption's new browser cases are triaged the same way.
- Device-name fixtures in `web/src/lib/fleet-roster.test.ts` and in archived changes: a separate
  change, opened right after the 3.4.0 release (decision 13).
- Upstream's `v1.8` pre-commit hook added its own guard D (the `flake.lock` guard), so the fork's
  private-fact guard is re-lettered **E** in the hook, its suite and the fork's privacy test; the
  `AGENTS.md` lines that still call it guard D (and the hatch table) are corrected with task 6.7, and
  the `private-fact-guard-port` reason with task 7.2.
- Upstream's `v1.8` hook also refuses any `## [Unreleased]` bullet without a bold lead sentence.
  The merge commit was made with `SKIP_VERSION_CHECK=1` after version consistency and the added
  Unreleased line were verified by hand; the shape is now adopted (decision 11), so no later commit
  needs that hatch.
- Renaming this fork's own pack vocabulary (`[pack]` configuration section, `[[invasive]]`/`[[owned]]`
  entry ids, `fleet-pack-*` capability names) is left to a later change by owner decision; it is kept
  unchanged here.

## Migration Plan

For the operator's deployment side, which owns it (nothing here is done by this change):

1. Level the lead first, then every member; bring every member to 3.4.0 before any later release that
   adopts Collie `v1.9.0` or newer — a member left on 3.3.x stops talking to that lead.
2. Tooling that polls the lead's census at `/api/pack` moves to `/api/crew` (same body: `members[]`
   with `id`, `health`, `version`, `lastSeenAt`); the old path answers 308 for this release only.
3. Snapshot-and-rollback of a member or the lead must include Collie's state files and, on rolling
   back to 3.3.x after 3.4.0 has started, rename `crew-trust.json`, `crew-ops.json`,
   `crew-runtime.json` back to their `pack-` names (the old file stays where the new one wins).
4. Journal filters match `[crew]` and `[pack]` across the upgrade; documents and configuration
   comments that cite `/pack/v1/*`, `PACK_PROTOCOL.md` or `COLLIE_PACK_*` are updated.
5. The Fleet configuration file needs no edit.
6. Member proof: each member appears in the lead's crew census as reachable at 3.4.0 with a fresh
   receipt, and no member logs the version 1 fallback once the lead runs 3.4.0; a manual fit on a
   member Pane still resizes it.

## Release

Cut as `3.4.0` (MINOR, from `3.3.0`, owner-confirmed; the remote's newest tag was still `v3.3.0`) in
one `chore(release): 3.4.0` commit, tagged `v3.4.0` and pushed with the tag named on the push line.
No GitHub Release is published. The `3.4.0` changelog section carries the member obligations above
in the operator's words: level the lead first, then every member, and all of them before any release
that adopts Collie `v1.9.0`; enrol a peer only after the lead runs 3.4.0; roll back across the state
rename by renaming `crew-*.json` back to `pack-*.json`; move census polling to `/api/crew`.

The push is not a completed adoption. The Migration Plan is the deployment side's hand-off, and this
change stays active until the operator reports every member on 3.4.0 through the new link (decision
10); task 10.2 archives it then.
