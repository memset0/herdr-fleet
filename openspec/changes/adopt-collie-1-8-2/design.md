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
- [`bridge/removal-schedule.test.ts` reads the package minor] → it reads this product's version, not
  Collie's: inert at 3.4, but it would misfire at a Fleet 3.9 before the `v1.9.0` adoption. Recorded
  for that adoption, which removes the overlap it guards.
- [Fleet enrolment has no cross-version fallback] → enrol only after the lead runs 3.4.0.

## Known follow-ups

Recorded here, not fixed by this change unless the fix turns out to be trivial:

- Upstream's `bridge/removal-schedule.test.ts` reads this product's `package.json` minor as if it
  were Collie's; it is inert at 3.4 and must be revisited by the adoption that crosses `v1.9.0`.
- Upstream's Playwright browser tier may not fit the fork's shell; any case that fails inside a
  declared port is reported per task 8.3, and rewriting an upstream case needs its own entry.
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
