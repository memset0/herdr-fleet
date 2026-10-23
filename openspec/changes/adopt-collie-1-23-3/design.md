## Context

See proposal.md, "Why". The ground was read before anything changed:

```
baseline  v1.22.6  tag a2ada8ff…  commit 9cc40c8a…   (FORK.toml [upstream]; = merge-base main v1.23.3)
target    v1.23.3  tag d20a39f2…  commit 5bb4233b…   604 files, 339 commits (v1.23.0 … v1.23.2 included)
preflight (bun scripts/check-fork.ts --target v1.23.3, before this change existed, no active change):
          23 of 31 invasive entries disturbed; 8 untouched; no owned path occupied
boundary  bun run test:fork: 21 pass; 1040 owned and 74 invasive paths
```

Upstream's changelog was not truncated: `v1.23.3`'s `CHANGELOG.md` carries `v1.22.6`'s text from its
`## [1.22.6]` heading down unchanged, so `COLLIE_CHANGELOG.md` becomes `v1.23.3`'s file verbatim, with
no seam and no reworded entry.

## Goals / Non-Goals

**Goals:** `v1.23.3` as real ancestry, every port reviewed; every Fleet send port kept on upstream's
reworked send rules; the skill sync off in Fleet through the narrowest port; walky talky kept and
inert; the Bun floor raised with upstream's; no automatic publication of either release line.

**Non-Goals:** as in proposal.md.

## Decisions

### 1. The merge and its conflicts

Fifteen paths conflicted, each inside a declared entry; `bun.lock` and `web/bun.lock` did not move.

- Contract files: `herdr-plugin.toml`, both `package.json` and `CHANGELOG.md` keep this product's
  identity and 3.22.0 (upstream's Edge comment on the manifest's version line is not carried: this
  product cuts no Edge build). `CLAUDE.md` stays the symlink; upstream's release-procedure edits there
  (Windows rehearsal only for a minor, the crew leg of the browser rig) are upstream's maintainer
  procedure and are not ported into `AGENTS.md`. `COLLIE_CHANGELOG.md` is `v1.23.3`'s file verbatim.
- `.github/workflows/release.yml`: upstream's Edge paragraph is taken, the fork's no-push-trigger
  paragraph follows it and now says an Edge tag publishes nothing either; the trigger stays
  `workflow_dispatch`, and upstream's new stamp steps below it are taken verbatim.
- `CREW_PROTOCOL.md`: upstream's §21 (walky talky) is taken whole; the fork's terminal identity
  extension stays the file's last section.
- `bridge/crew/forward.ts`: the `pane.focus` audit name and upstream's `walky.deliver` stand side by
  side; upstream's method-aware walky read check and the fork's send-forward budget both auto-merged.
- `web/src/lib/api.ts`, `web/src/lib/loaders.ts`, `web/src/routes/detail.tsx`: import conflicts only —
  the fork's send budget, census view and content renderer type beside upstream's walky imports.
- `web/src/components/display-prefs.tsx`, `web/src/components/agent-chat.tsx`: the `afterTextSize`
  slot and upstream's `setStretchText` both.
- `web/src/components/chat-cards.tsx`: upstream's walky receipt line and message-id chips taken, the
  `data-chat-inset` markers kept on the same body and output elements.
- `web/src/components/composer.tsx`: both prop sets (`bindingPane`, `instance`); the fork's
  `hasDraft` and microphone commands kept and upstream's `micIsPrimary` not reintroduced; upstream's
  walky composer, `canMessage` and Send long press taken; its "Send as message" menu stands before
  the record control; `submitLine` keeps the destructive gate and typed send, `onSendClick` takes
  upstream's walky branch and the shell-aware `composeLine`; task delivery is also withheld while a
  message aim is set or a message is sending.

Two fork-owned suites needed upstream's new `stretchText` preference (`fleet-chat-typography`,
`fleet-task-composer`); both typechecks are otherwise clean on the merge.

### 2. Every Fleet send port stays (owner decision)

The ports keep their numbers and decisions: `BOUNDS` and `POLL_GAP_MAX_MS`, the probe cleanup and the
S0 probe sweep, `KEY_TOKEN_LIFETIME_MS` (3 s, `fleet/send-patience.ts`, `bridge/surface/key-gate.ts`),
`SEND_REQUEST_TIMEOUT_MS`, `TAP_SETTLE_DEADLINE_MS`, Codex's Enter that steers (`fleet/enter-steers.ts`
through `fleetProfile` and the one `commitKeys` line), the disabled hold queue (`sendHolds.enabled`
gating `holdsEnd` and the join check) and the Claude notice hint (`fleet/profile-tunes.ts`).

Upstream's send changes between the two releases, read against them:

- **The turn checked again at S1** (1.23.0, PR 491, `turnAtS1`). A turn that starts while the text is
  typed now meets S0's turn rule on the read Enter is minted on. When the rule lets the send go ahead
  on a harness whose Enter does not queue, upstream marks it `streamed`, so `commitKeys` takes the
  in-turn path — where the fork's Enter-steers line returns Enter for a Codex text. That is the same
  decision the fork made for a turn read at S0, so no new port is needed; `fleet-enter-steers` gains
  the scenario. A send the rule would refuse or hold ends `typed_not_submitted` with its text in the
  box, never held, which agrees with the disabled hold queue.
- **An open question makes a released hold wait** (`answersQuestion`, `putBack(id, counted)`). It acts
  only on a released hold; Fleet holds nothing new, so it only governs requests held before the switch
  turned off.
- **A notice key on the first line asks first; letters match case-insensitively** (1.23.2,
  `noticeAnswer`). Upstream's rule replaces the old whole-text rule; nothing of the fork's sits there.
- **The Claude survey read as a notice, pi's extension box, the Grok and opencode running rows, the
  Muse `paste.settleMs` pause, the empty-box compare by its edges, the blind-sent note** — all in
  upstream's profiles, readers and the protocol's own lines; none touches a fork line. The Claude
  notice hint is a `volatile.below.hints` entry added at load, independent of `idle.notices`.
- `bridge/surface/key-gate.ts` is unchanged upstream.

If a port and an upstream change had conflicted in behaviour, the adoption would have stopped; none
did.

### 3. `collie skill sync` is off in Fleet (owner decision)

Upstream (ADR 0111) runs `collie skill sync` from `cli/update.ts`'s `syncSkill` after an in-place
update, the detached runner's apply (update, rollback, line switch, crew follow) and both terminal
rollbacks. The phone's Update and Roll back reach it through `bridge/update-action.ts`, which on Linux
starts `collie update` in a `systemd-run --user` transient unit with a bare environment — so a value
Fleet put in its Collie child's environment would not reach it, and an environment-only switch is not
enough.

The decision therefore lives in the fork-owned `fleet/skill-sync.ts`: in a checkout whose
`herdr-plugin.toml` names `memset0.herdr-fleet`, the sync runs only when `COLLIE_SKILL_SYNC` says an
on-word; anywhere else it returns upstream's own `skillSyncEnabled` verdict. `syncSkill` gains one
import and one call (`cli/update.ts`, new invasive entry `fleet-skill-sync-off-port`), so its two
branches stay upstream's: off prints upstream's note (`skill status --check`, read-only), on runs the
sync. Rejected: flipping upstream's default in `cli/skill-sync-result.ts` (rewrites upstream's update
suite, which tests the default); setting the variable in the Collie child's environment (misses the
transient unit); a fleet.toml switch (a configuration surface for something nobody asked to turn
on). `collie skill install` / `sync` by hand stay the operator's acts.

### 4. Walky talky is adopted as shipped (owner decision)

The bridge, its local socket, `/api/walky*`, the signed crew route and the phone cards are upstream's
and unwired by Fleet. The Gateway has no route allowlist, so the phone's walky routes pass like any
other; `/crew/` stays refused at the Gateway, and the crew route rides the existing pinned link.
`COLLIE_WALKY` is left at upstream's default. The Fleet MSW handlers and route suites are checked
against the new routes (section 6).

### 5. Bun floor 1.4.4 and release lines

Collie's `MIN_BUN` is 1.4.4 from 1.23.3; the fork has no `engines` field and no preflight of its own,
so the floor is stated where Fleet states it — `fleet/README.md` and `fleet-stt-deadline-compat` —
and taken from upstream unchanged in `cli/update-check.ts`. Release lines: `release.yml` keeps its
`workflow_dispatch` trigger, so neither a `vX.Y.Z` nor a `vX.Y.Z-edge.N` tag publishes; the fork
pushes no Edge tag, and a Fleet member never follows a line because Fleet never runs the updater on
it.

### 6. Every entry reviewed against v1.23.3

All 31 entries were reviewed with their verify lists and advanced; none is dropped, because
`v1.23.3` does none of what they do, and one is added (section 3).

- Kept, untouched by the release: native-row-actions-menu, native-agent-favorites,
  authenticated-navigation-cache (upstream's worker unchanged), native-pane-chrome, private-fact-guard,
  stable-table-corpus-test, portable-tool-lookup-fixture, offline-page-fixture-setup.
- Kept, the release touched their files and not their ports: repository-guidance, plugin-identity,
  downstream-version-line (upstream's MIN_BUN stubs and new release-notes cases still read Collie's
  sections from `COLLIE_CHANGELOG.md`), fleet-build, pane-surface-route, declined-centred-history-column,
  native-webfont (no new face; the Stretchtext hues are colours), upstream-removal-clock,
  panel-navigation-ancestry, portable-loose-install-fixture.
- Kept, reason extended for what the release added beside them: unnarrowed-pack-rows (walky list read),
  fake-network-fleet-routes (walky and subagent handlers), native-pane-content (walky log provider,
  subagent sheet), native-manual-pane-fit and native-pane-page (Stretchtext switch, walky `instance`),
  crew-focus-audit-name (`walky.deliver`; upstream still records a bare `focus`),
  native-navigation-sidebars (Crew page messaging card, Updates and Harness pages),
  terminal-binding-pin (pane `instance` token, CREW_PROTOCOL §21), native-chat-density-markers (walky
  rows marked, new walky and subagent cards unmarked).
- Adapted: composer-voice-rank (walky message mode; task delivery gate), no-automatic-release-publication
  (Edge tags), patient-send-protocol and codex-enter-steers (the S1 turn check; one fork case added).
- Added: fleet-skill-sync-off-port.

```
before  31 invasive entries, 74 invasive paths, 1040 owned paths
after   32 invasive entries, 75 invasive paths, 1048 owned paths
```

### 7. Walky talky against the Fleet routes

The Gateway refuses `/crew/` and `/pack/` before proxying and allowlists request headers; the phone's
walky routes add no request header, so they pass as JSON like any other `/api/` route. The crew routes
(`/crew/v1/walky`, `/crew/v1/pane/:id/walky`, `/crew/v1/walky/outcomes`) ride the native link through
the peer's own reachability transport, which carries the whole `/crew/v1/*` surface unchanged. The
fork's MSW Fleet route (`/fleet/api/settings` 404) and its suites pass beside upstream's new handlers.

## Risks / Trade-offs

- A Fleet machine below Bun 1.4.4 still runs; upstream's preflight says amber. The operator levels
  Bun before or with the release.
- An operator who wants the skill on agents must install it by hand or turn the sync on; that is the
  owner's choice.
