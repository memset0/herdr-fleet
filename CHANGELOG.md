# Changelog

Herdr Fleet's own changes are recorded here. Collie's are not: its history is retained in
[`COLLIE_CHANGELOG.md`](./COLLIE_CHANGELOG.md) — the adopted release verbatim, and anything upstream
has since dropped kept below it — and unchanged Collie behaviour is upstream behaviour rather than a
release of ours. **Write in this file, not that one.**

**The version line is this product's own**, beginning at `3.0.0`. It is not Collie's, and adopting a
newer Collie changes only the provenance recorded in [`UPSTREAM.md`](./UPSTREAM.md) — never this
number. The format follows [Keep a Changelog](https://keepachangelog.com/) and the versioning is
[Semantic Versioning](https://semver.org/) on the axis stated in [`AGENTS.md`](./AGENTS.md) →
*Versioning and releases*.

Work that has landed but is not released yet collects under `## [Unreleased]`; the release commit
renames that heading to `## [x.y.z] - YYYY-MM-DD`, appends each line's short commit hash, and opens
an empty one above it. The newest *numbered* `## [x.y.z]` heading, which the Unreleased heading is
not, **must** match the `version` in `herdr-plugin.toml`, `package.json`, and `web/package.json`
(enforced by `scripts/check-version.sh`).

## [Unreleased]

### Fixed

- **Agent headings truncate as one phrase.** Keep Space and work name together with one trailing ellipsis.

## [3.7.5] - 2026-10-04

**Lead-only frontend update; members do not redeploy.**

### Changed

- **Agent rows use tighter edge spacing.** Preserve internal line gaps and independent touch targets. ([b9cccb21](https://github.com/memset0/herdr-fleet/commit/b9cccb21))

## [3.7.4] - 2026-10-04

**Lead-only frontend update; members do not redeploy.**

### Changed

- **Agent cards give text more room beside stacked controls.** Shrink titles and tags, place the favorite above tag editing, and omit prompt-cache readings from the rail. ([3f781b9d](https://github.com/memset0/herdr-fleet/commit/3f781b9d))
- **Agent groups put the newest work first.** Recent follows last-seen time; Ready and Working follow last activity, with stable ties and unchanged native pin order. ([584684a7](https://github.com/memset0/herdr-fleet/commit/584684a7))

## [3.7.3] - 2026-10-04

**Lead-only frontend update; members do not redeploy.**

### Added

- **Send Alt+Up joins the command bar.** The unbound Pane command sends one fixed chord through the existing guarded writer. ([0652004a](https://github.com/memset0/herdr-fleet/commit/0652004a))

## [3.7.2] - 2026-10-04

**Lead-only frontend update; members do not redeploy.**

### Changed

- **Compact the navigation footer with a sliding surface selector.** Center a smaller gray build caption beneath the shared Collie/TTYD track, preserving touch targets and reduced motion. ([76f304ab](https://github.com/memset0/herdr-fleet/commit/76f304ab))

## [3.7.1] - 2026-10-02

**Every member redeploys, lead first; no operator configuration changes.** Colored pane tags are
maintained on the lead and shared across browsers. The minor transition from 3.6 is required by the
speech deadline correction in the bridge; members need this release to receive that fix. The crew
wire contract is unchanged during rollout. Tag definitions and associations are retained in the
lead's private configuration directory, and rollback leaves that document and local favorites intact.

The `v3.7.0` tag was accidentally attached to the preceding development commit, whose manifests
still declare `3.6.0`. It is retained as a historical record, not a matching release tag. Use
`v3.7.1` or later for the 3.7 line.

### Added

- **Shared colored tags stay with panes across browsers.** Create or select tags from Agent rows, show their names on a separate wrapping line, and rename or recolor them globally from the rail or Settings; the lead persists definitions and associations with conflict-aware saves. ([67b5e36](https://github.com/memset0/herdr-fleet/commit/67b5e36))

### Fixed

- **Speech deadlines survive the gaps between operation phases.** Keep the supported runtime’s timeout signal subscribed through token lookup, request and stalled response disposal; preserve the existing timeout budget and cancellation behavior. ([67b5e36](https://github.com/memset0/herdr-fleet/commit/67b5e36))
- **Corpus verification no longer depends on filesystem enumeration order.** Sort fixture filenames before the exhaustive table assertion without changing expected captures. ([67b5e36](https://github.com/memset0/herdr-fleet/commit/67b5e36))

## [3.6.0] - 2026-10-02

**Every member redeploys, lead first; no operator configuration changes.** This release adopts
Collie 1.15.0: Chat as an opt-in pane body, Settings as an index of four sections, Copy output in the
pane menu, push titles in the device's language and upstream's fixes. Level the lead first, then each
member; crew protocol stays 2 with additive reads, so a 3.5.x member beside a 3.6.0 lead keeps
working in the short gap, and rolling a machine back to 3.5.x is a plain redeploy with nothing renamed
on disk. The fork's two temporary harness ports remain: the Codex headless status-row port now sits on
upstream's goal-row reading, and the Claude mode-line port now also covers the `esc to interrupt` and
`← for agents` hints a working turn with background agents prints. Behind the Gateway, opening a pane
now marks it seen, because the Gateway forwards Collie's seen signal, and the Agents rail gains a
"Mark all seen" control. The Gateway serves the boot splash's new header marks before sign-in in place
of the retired gallop sprite.

### Added

- **Mark every unseen pane seen from the Agents rail.** A control beside the rail's summary line, shown with its count while any pane on any host is unseen, sends Collie's own seen read to each one and refreshes; the Pane page's switcher sheet carries it too. ([31b6113](https://github.com/memset0/herdr-fleet/commit/31b6113))

### Changed

- **Adopt Collie 1.15.0.** Chat as an opt-in pane body, Settings as four sections, the pane switcher's Place, Activity and cache orders, Copy output in the pane menu, push titles in the device's language, tool calls folded in History, the experimental tuios backend and upstream's fixes, including the Codex goal-row reading (#317) beneath the fork's headless status-row port. ([da8bdeb](https://github.com/memset0/herdr-fleet/commit/da8bdeb))
- **The terminal surface also replaces Collie's new Chat body.** Under it no Chat switch is offered and no live session window is read; Resize stands below Text size among the terminal rows of the belt's Display sheet and not among Chat's, and every Settings page, the index and its sections, fills the column between the rails with the Fleet group at the head of the index. ([f23db66](https://github.com/memset0/herdr-fleet/commit/f23db66))

### Fixed

- **Claude's working-turn mode line no longer reads as a dialog.** With background agents running, `esc to interrupt` and a trailing `↓ to manage` on the permission-mode line are dropped before the tail checks, with or without an agent count, whole or clipped; the port stays temporary. ([d9b7fb7](https://github.com/memset0/herdr-fleet/commit/d9b7fb7))
- **The boot splash's two header marks load before sign-in.** Collie 1.15's splash draws `/collie-mark-header-{light,dark}.svg` instead of the gallop sprite, so the Gateway serves both exact paths without a session and no longer the sprite, which no page draws any more. ([1b98cf6](https://github.com/memset0/herdr-fleet/commit/1b98cf6)) ([b73c7b9](https://github.com/memset0/herdr-fleet/commit/b73c7b9))
- **Behind the Gateway, opening a pane marks it seen.** The Gateway now forwards Collie's seen header, which carries no credential, so a pane read reaches Collie as the operator looking at it. ([31b6113](https://github.com/memset0/herdr-fleet/commit/31b6113))

## [3.5.3] - 2026-10-01

**Frontend and Gateway only; no member is obliged to redeploy, and the lead alone levels.** Host rows
now judge each member against the lead's own running version rather than this product's published
tags, so the Gateway's `/fleet/api/version` route and its outbound tag lookup are gone, and with them
the "Last checked" and "Freshness unavailable" wording. A member on the lead's major.minor reads as
compatible whatever its patch.

### Changed

- **Host rows compare each member with the lead, not with published tags.** The lead's own runtime version from the same `/api/crew` read is the reference: same major.minor is compatible, a lower minor is outdated, a higher lead major is a manual update; "Last checked" and "Freshness unavailable" are gone, and the Gateway's `/fleet/api/version` route and its outbound tag lookup are removed. ([f928a7f](https://github.com/memset0/herdr-fleet/commit/f928a7f))

## [3.5.2] - 2026-10-01

**Frontend-only; no member is obliged to redeploy, and the lead alone levels.** The Agents rail and
its footer now follow Collie's own rows and the tab bar, and CJK text in the default UI face reaches
the selected fallback font. Favourites are now Collie pins: each browser migrates its stored
favourites once, against the first snapshot that lists Agents, and favourites of panes that are
offline at that moment are dropped rather than kept. The Claude background-agent hint and the headless Codex status-row readings are
temporary ports that stay only until upstream reads those screens itself.

### Changed

- **The Agents rail draws Collie's own rows.** 44px rows with a leading status dot, the 16px agent mark, a 16px/500 name, 12px meta, Collie's unseen square and pane meta, cards only for Needs you, and the pane on screen marked `aria-current` on the accent ground; the where-then-what order stays. ([6cc0bd3](https://github.com/memset0/herdr-fleet/commit/6cc0bd3))
- **The star is Collie's pin; the separate favourites store is retired.** The star on dashboard and rail rows pins or unpins through Collie's own store, the rail leads with a Pinned group, and stored favourites whose panes are live become pins once (the rest are dropped) before the old key is deleted. ([6cc0bd3](https://github.com/memset0/herdr-fleet/commit/6cc0bd3))
- **The rail's summary line is the dashboard's.** It says "Nothing needs you" only when no pane needs you or waits unseen. ([6cc0bd3](https://github.com/memset0/herdr-fleet/commit/6cc0bd3))
- **Rail controls take Collie's shapes.** The star is the 36px round button with a 16px glyph, and the Collie/TTYD switch is Collie's segmented control with a filled primary pill. ([6cc0bd3](https://github.com/memset0/herdr-fleet/commit/6cc0bd3))
- **The rail footer meets the tab bar on one line.** The build row is the tab bar's 56px band, rule and ground, on desktop and in the phone drawer. ([6cc0bd3](https://github.com/memset0/herdr-fleet/commit/6cc0bd3))
- **The Agents rail stands from 1536px.** Below it the Pane page's Switch entry carries the rail, and the hierarchy rail is capped so a 1280px pane column (1056px) is no longer narrower than a 1024px one. ([6cc0bd3](https://github.com/memset0/herdr-fleet/commit/6cc0bd3))
- **The Pane screen no longer repeats its own state.** The fork's tab-row badge and folded-bar word are gone; Collie's dots and header mark state it. ([6cc0bd3](https://github.com/memset0/herdr-fleet/commit/6cc0bd3))
- **Rail and drawer titles use Collie's sheet-title voice.** Rail groups take its 13px workspace-heading voice in their own case; Pinned keeps Collie's muted caption. ([6cc0bd3](https://github.com/memset0/herdr-fleet/commit/6cc0bd3))

### Fixed

- **CJK text in the default UI face now reaches the selected fallback.** Collie's unlayered splash mirror of the default stack shadowed the fork's `@layer theme` hole, so rail headings, tab labels and belt labels drew CJK in the system font; an unlayered default stack in `index.css` now carries `var(--font-cjk)`. ([3c14eec](https://github.com/memset0/herdr-fleet/commit/3c14eec))
- **Claude's background-agent hint no longer reads as a dialog.** Claude Code 2.1.286's mode-line suffix `← N agents · ↓ to manage` (or its clipped `↓ to ma…`) left a working pane with no composer and an unreadable-dialog card; a temporary port reads it as the mode line until upstream does. ([2ac305c](https://github.com/memset0/herdr-fleet/commit/2ac305c))
- **A headless Codex's multi-item status line reads as a status row (temporary).** With no colour answered, the glued `· ` separators, the gap merged into `⚠` and the uncoloured `⚠ 1 warning · f2 to view` notice no longer leave an idle pane composer-less under the unread-dialog card; a temporary port until upstream reads such rows. ([c3d86de](https://github.com/memset0/herdr-fleet/commit/c3d86de))

## [3.5.1] - 2026-10-01

**No member is obliged to redeploy; the lead alone levels.** A member's start, and both enrolment
commands, now refuse a `crew-trust.json` still in the pre-Collie-1.9 inner shape (a top-level `pack`
key and no `crew`) instead of starting a member that cannot authenticate its lead. A member whose
store is already in the current shape behaves exactly as on 3.5.0; one that is not must have its store
rewritten by its previous release (3.4.x) before running 3.5.0 or later in any case.

### Fixed

- **Refuse a trust store still in the pre-Collie-1.9 `pack` shape.** Start and both enrolment commands now fail closed on a `crew-trust.json` with a top-level `pack` key and no `crew`, naming the file and keys and changing nothing, instead of starting a member that cannot authenticate its lead; rewrite it with 3.4.x's trust-store no-op commit first. ([c5fcc9d](https://github.com/memset0/herdr-fleet/commit/c5fcc9d))

## [3.5.0] - 2026-10-01

**Every member redeploys, lead first, and all of them must run 3.5.0 or later.** This release adopts
Collie 1.14.2. Collie 1.9 removed the 1.7/1.8 wire overlaps, so the lead and every member must both
run 3.5.0 or later: level the lead first, then each member right after it (a 3.4.0 member already
speaks crew protocol 2, so the short gap between them is not a breakage window). Fleet now hands
Collie its state directory as `COLLIE_STATE_DIR`, the same directory Fleet already validates trust
in, so nothing moves on disk. A Collie `config.toml` that sets a Fleet-owned setting now refuses
Fleet's start, naming the file and the key; no machine has such a file today. A trust directory
holding only `pack-*.json` files is refused with Collie's own notice. `/api/pack` is gone; tooling
that polls the lead's census reads `/api/crew`. No operator configuration changes are required, and
rolling a machine back to 3.4.0 is a plain redeploy.

### Changed

- **Adopt Collie 1.14.2.** The actions belt, the one-box composer with attachment chips, the Changes view, the dashboard footer tabs, layered configuration files, prompt-cache countdowns, pinning and hiding a machine, and upstream's fixes; the record control stays a control of its own beside Send inside the box. ([67a62f9](https://github.com/memset0/herdr-fleet/commit/67a62f9))
- **Fleet states its Collie child's state directory and owns its settings.** Collie is started with `COLLIE_STATE_DIR` set to the directory Fleet validates trust in, and a Collie `config.toml` that sets a Fleet-owned setting refuses Fleet's start, naming the file and the key; the 1.7/1.8 overlap fallbacks are gone, so the lead and every member run 3.5.0 or later and a state directory holding only `pack-*.json` names is refused with Collie's own notice. ([6c6cd63](https://github.com/memset0/herdr-fleet/commit/6c6cd63))

### Fixed

- **Back from a pane reached through a rail goes up a level.** The Herds and Agents rails, the phone's pane switcher and the pane commands now open a pane the way upstream does since 1.13 — a replace when switching from another pane — so Back no longer returns to the pane just left. ([cb531ff](https://github.com/memset0/herdr-fleet/commit/cb531ff))
- **Stop the roster and Agent rail fixtures naming real machines.** Their host, Tab and workspace labels were real machine and repository names; they now use upstream's synthetic outbuilding names, and each test pins the same distinction as before. ([aa84d81](https://github.com/memset0/herdr-fleet/commit/aa84d81))

## [3.4.0] - 2026-09-30

**Every member redeploys, lead first.** This release moves the link between the lead and its members
onto Collie's crew link (`/crew/v1/*`, wire protocol version 2). Collie keeps one release of
overlap, so a 3.3.x member and a 3.4.0 lead keep working in either order, but every member must be
on 3.4.0 before any release that adopts Collie `v1.9.0` or newer. Enrol a new peer only after the
lead runs 3.4.0: Fleet's enrolment has no fallback to protocol version 1. Collie renames its state
files from `pack-*.json` to `crew-*.json` the first time 3.4.0 runs, so rolling a machine back to
3.3.x after that requires renaming `crew-trust.json`, `crew-ops.json` and `crew-runtime.json` back
to their `pack-` names. Tooling that polls the lead's census moves from `/api/pack` to `/api/crew`;
the old path answers 308 for this release only. The Fleet configuration file needs no edit.

### Added

- **Show each Host's full Fleet build and this page's build.** Each Host carries compatible, outdated, manual-major, development, last-reported, stale, or unavailable evidence, and this page's build sits below the shared Collie/TTYD selector. ([8b42c2c](https://github.com/memset0/herdr-fleet/commit/8b42c2c))

### Changed

- **Adopt Collie 1.8.2.** The crew rename with protocol version 2 and its one-release `/pack/v1/*` overlap, per-host multiplexer capabilities, and upstream's fixes. ([40f3101](https://github.com/memset0/herdr-fleet/commit/40f3101))
- **Follow Collie's crew naming and wire protocol version 2.** Enrolment posts protocol 2 to `/crew/v1/enroll` after Collie's own state move, the probe budget is projected as `COLLIE_CREW_TIMEOUT_MS` with both spellings reset, trust state is read as `crew-trust.json` with a read-only fallback to `pack-trust.json`, and the public Gateway refuses `/crew/*` as it refuses `/pack/*`. ([898f68c](https://github.com/memset0/herdr-fleet/commit/898f68c))

### Fixed

- **Share terminal startup across concurrent browsers.** Interrupted acquisitions are cleaned up, and external Herdr attachments are taken over on lead and peer without displacing another Fleet browser. ([4885706](https://github.com/memset0/herdr-fleet/commit/4885706))
- **Keep the native Pane AppBar and actions in terminal mode.** The terminal matches the mirror's horizontal gutter and ignores fit reports without a current drawable host. ([4885706](https://github.com/memset0/herdr-fleet/commit/4885706))
- **Reserve the native scrollbar gutter in terminal fit.** It now matches an overflowing Collie mirror. ([7a25076](https://github.com/memset0/herdr-fleet/commit/7a25076))
- **Count both sides of an upstream rename in the adoption preflight.** Each moved port's destination is named, whatever Git's rename setting. ([d6a5695](https://github.com/memset0/herdr-fleet/commit/d6a5695))
- **Run Collie's scheduled-removal checks against the adopted Collie release.** They read `FORK.toml`'s upstream tag, not this product's version; Collie 1.8.2's new layout and browser tests account for the Fleet rails and network-first navigation. ([65c9987](https://github.com/memset0/herdr-fleet/commit/65c9987))
- **Stop the navigation rails reserving the notch under an open strip band.** Each rail hands the top safe-area inset to the band as the header does, so rail titles line up with the header. ([09efa2d](https://github.com/memset0/herdr-fleet/commit/09efa2d))

## [3.3.0] - 2026-09-07

### Added

- The Gateway has a terminal boundary: an authenticated upgrade that names a Pane and can name nothing else, a resolver that turns that Pane into its terminal on the machine that owns it, and a bounded set of held sessions so leaving a Pane and returning does not re-attach. ([e05627f](https://github.com/memset0/herdr-fleet/commit/e05627f))
- A Pane's terminal can be attached to over a WebSocket: the connection carries terminal input and the browser's viewport and nothing else, the terminal takes the browser's geometry while it is attached, and a session that is revoked or expires closes the terminals opened with it. ([2ecb065](https://github.com/memset0/herdr-fleet/commit/2ecb065))
- A Peer may declare an optional `[terminal]` table, and a Lead an optional terminal endpoint per member. A configuration that omits them is unchanged. ([2ecb065](https://github.com/memset0/herdr-fleet/commit/2ecb065))
- A Pane can be drawn as the terminal it mirrors. One switch chooses the surface for every Pane in this browser; it defaults to the mirror, and with it there the Pane route is the route it was. The terminal takes the browser's viewport while it is attached and shows the size it is at, a selection copies, and a program's own copy request is honoured within a bound while its request to READ the clipboard is refused. ([1adb505](https://github.com/memset0/herdr-fleet/commit/1adb505))
- That switch stands in Settings, at the foot of the left rail and in the drawer a phone slides in, as `Collie` and `TTYD` — one switch behind all three, so flipping any of them moves the others. ([70e3fb5](https://github.com/memset0/herdr-fleet/commit/70e3fb5)) ([fb78bd7](https://github.com/memset0/herdr-fleet/commit/fb78bd7))
- A member can serve its own Panes as terminals. It resolves each Pane against its own multiplexer server on every request, starts one terminal server for it after checking the executable's digest, and answers three operations on one loopback endpoint the link now projects a third time. It holds nothing until something asks, and stands itself down when nothing has for an hour — which the supervisor reports as idle rather than as a failure. ([7b5826c](https://github.com/memset0/herdr-fleet/commit/7b5826c))

### Changed

- A pane row in the switcher reads as an address: space, tab, then the pane's own name, then the host as a tag. Where it lives leads, because a dozen rows are called `claude`. ([378eae6](https://github.com/memset0/herdr-fleet/commit/378eae6))
- That host tag is the same one the rest of the app uses, so it carries the machine's own colour and says when the lead cannot reach it — and it hides itself when there is only one machine. ([417f4be](https://github.com/memset0/herdr-fleet/commit/417f4be))
- A match is marked with the highest-contrast ink and an underline instead of bold, so marking no longer shifts the text around it as you type. The host tag is never marked. ([378eae6](https://github.com/memset0/herdr-fleet/commit/378eae6))
- The command palette no longer lists `Open Command Bar` — choosing it from the palette set the mode it was already in and did nothing. It stays bound and stays in the settings reference. ([8cc7337](https://github.com/memset0/herdr-fleet/commit/8cc7337))

### Fixed

- A sided chord such as `LAlt+Q` fires again. Pressing a modifier moves focus to the menu bar on some platforms, and the recognizer was throwing away the side it had just recorded whenever focus moved — on exactly the sequence it was meant to protect. It now reconciles what is held against each event's own modifier state instead. ([d615586](https://github.com/memset0/herdr-fleet/commit/d615586))
- A prefix sequence completes with a Chinese input method on: while a prefix is armed the caret is parked off the composer, so the IME has nothing to compose into and the second chord arrives as an ordinary key. It returns to the offset it left. An unregistered second chord now costs one character, deliberately. ([471e187](https://github.com/memset0/herdr-fleet/commit/471e187))
- A pending prefix outranks a focus-return still settling from an earlier command, which used to un-park the caret a tick later and hand the second chord back to the input method. ([471e187](https://github.com/memset0/herdr-fleet/commit/471e187))
- The switcher names the lead machine by the name the navigation rail shows, not the internal id. The host tag appears only on a pack, and searching a host now matches the name that is displayed. ([378eae6](https://github.com/memset0/herdr-fleet/commit/378eae6))
- The terminal surface draws in the font it was always meant to: the operator's own terminal face with the CJK fallback under it, the same pair the mirror reads. It was rendering in the app's UI typeface — a proportional face in a monospace grid — which is why the letters looked spaced out and Chinese was not twice the width of Latin. It also measures again when a face finishes loading, which is the other half of the same symptom. ([8ad0f8f](https://github.com/memset0/herdr-fleet/commit/8ad0f8f))
- A terminal server's readiness is judged with `stat`, not a file-existence check: the runtime answers false for a UNIX socket, so every terminal waited out its readiness timeout and was then killed for never having started. ([0606ab5](https://github.com/memset0/herdr-fleet/commit/0606ab5))
- A Gateway whose temporary socket directory has been swept away serves terminals again: the directory is remade before each start, and a terminal server that never binds its socket now says which layer gave up instead of failing silently. ([3b22454](https://github.com/memset0/herdr-fleet/commit/3b22454))

## [3.2.0] - 2026-09-05

### Added

- Adopting a newer Collie release now follows a written procedure with a preflight: `check-fork.ts --target <tag>` verifies the release identity and merge base, refuses a dirty tree, and reports every port the release disturbs and every owned path it now ships. ([252ee14](https://github.com/memset0/herdr-fleet/commit/252ee14))
- `FORK.toml` records which upstream release each invasive port was last reviewed against, and the boundary check fails while any port lags the adopted release. ([252ee14](https://github.com/memset0/herdr-fleet/commit/252ee14))

### Changed

- The Pane and history screens fill the route column between the rails again, declining the centred 768px column Collie 1.5.1 introduced: the rails already claim the width that cap exists to fill, so inside them it took width from the mirror. Both lines are now declared in `FORK.toml`, so a later release is reported rather than inherited. ([81ecde9](https://github.com/memset0/herdr-fleet/commit/81ecde9))
- Collie's retained changelog is accumulative rather than byte-identical, so entries upstream truncates away are kept below one seam marker. ([252ee14](https://github.com/memset0/herdr-fleet/commit/252ee14))
- The fork boundary check runs in CI. ([252ee14](https://github.com/memset0/herdr-fleet/commit/252ee14))
- Adopted Collie 1.5.1, which brings upstream's pack-update orchestration, its updates page and update band, a QR pairing flow and a long tail of fixes. All eighteen invasive ports were reviewed against it and kept. ([857660b](https://github.com/memset0/herdr-fleet/commit/857660b))
- Adopted Collie 1.5.2: a Traditional Chinese locale, bounded speech-to-text provider lifecycles, a pre-commit hook suite, clipped and muted terminal rules, and a pane column that grows past 768px upstream-side. All nineteen invasive ports were reviewed against it and kept, including the two that decline that column. ([36aa7f2](https://github.com/memset0/herdr-fleet/commit/36aa7f2))
- The Traditional Chinese dictionary carries this fork's own strings, so the new locale is complete rather than partial. ([36aa7f2](https://github.com/memset0/herdr-fleet/commit/36aa7f2))

## [3.1.1] - 2026-09-05

### Added

- The lead's pack poll interval and per-peer probe budget can be stated in its own configuration, for a fleet whose members are a WAN away rather than a room away. ([b437be0](https://github.com/memset0/herdr-fleet/commit/b437be0))

### Fixed

- A member the lead has never heard from is arriving, not refusing: a zero receipt was being read as an age of thirty years, which called a just-enrolled member unreachable on its first sweep. ([b437be0](https://github.com/memset0/herdr-fleet/commit/b437be0))
- A refusal its receipt does not corroborate now reads as a slow link, and its rows stay open — one cold handshake on a distant member is not an outage. ([b437be0](https://github.com/memset0/herdr-fleet/commit/b437be0))

## [3.1.0] - 2026-09-05

### Fixed

- Resizing a pane on another pack member now works: the route was never federated, so the lead answered 501 and the operator saw a plain "could not be resized". Every member must be redeployed before it works across the link. ([58631e6](https://github.com/memset0/herdr-fleet/commit/58631e6))
- The lead's audit line for a forwarded focus or resize now matches what the peer writes (`pane.focus` / `pane.resize`), so the two logs read against each other. ([58631e6](https://github.com/memset0/herdr-fleet/commit/58631e6))

## [3.0.3] - 2026-09-05

### Added

- The microphone is three commands — start, stop and toggle — in the command palette, acting on the composer's own recorder. ([bb73598](https://github.com/memset0/herdr-fleet/commit/bb73598))
- A command can refuse instead of failing: a start while already recording, or anything while a clip is still transcribing, says so in one red message and changes nothing. ([bb73598](https://github.com/memset0/herdr-fleet/commit/bb73598))
- A binding can name a modifier as its key (`RAlt`) and can name a side wherever a modifier appears (`RAlt+Q`); an unsided `Alt` still means either. ([bb73598](https://github.com/memset0/herdr-fleet/commit/bb73598))

### Changed

- A pane row in the switcher shows its whole address — `tab · space`, plus the host where there is one — instead of swapping the slot's meaning depending on what the query matched; the marks land on whichever part matched. ([8e88495](https://github.com/memset0/herdr-fleet/commit/8e88495))
- The pane-resize command is called `Resize Pane`, not `Fit Current Pane Width` — the palette is searched by the word you use, and `resize` used to find nothing. ([2f9a108](https://github.com/memset0/herdr-fleet/commit/2f9a108))

### Fixed

- The caret return holds the page it was scheduled on, so a pending return can never reach for a document that has gone. ([c20c885](https://github.com/memset0/herdr-fleet/commit/c20c885))

## [3.0.2] - 2026-09-05

### Changed

- A shortcut hands the caret back to the composer — same offset where it took one, end of the field otherwise, and end of the field after a command that moved you to another pane. ([09e8efe](https://github.com/memset0/herdr-fleet/commit/09e8efe))
- The pane switcher matches a pane on its host, its space, its tab and its own name, and the row shows which of them it matched. ([09e8efe](https://github.com/memset0/herdr-fleet/commit/09e8efe))
- Renaming is one surface with one save, whether it is reached from a key or from the row-actions menu. ([26d60b5](https://github.com/memset0/herdr-fleet/commit/26d60b5))
- Every question the keyboard asks is one shared panel, and a confirmation's `y/N` sits in its heading rather than beside the field. ([f41ee02](https://github.com/memset0/herdr-fleet/commit/f41ee02))
- Closing a tab or a pane from the keyboard now asks on the command bar's panel — `y/N`, already holding `y`, so Enter confirms and anything else declines. ([78166b0](https://github.com/memset0/herdr-fleet/commit/78166b0))
- This product no longer publishes GitHub Releases: a pushed tag marks the version and triggers nothing, and the tag check says so. ([fac087e](https://github.com/memset0/herdr-fleet/commit/fac087e))

## [3.0.1] - 2026-09-04

### Fixed

- The settings document now reaches the keyboard: bindings written on disk are the ones that fire, and a save takes effect without a reload. ([2c46914](https://github.com/memset0/herdr-fleet/commit/2c46914))
- The rename input's panel no longer stretches to the bottom of the viewport. ([2c46914](https://github.com/memset0/herdr-fleet/commit/2c46914))

### Changed

- The record button stands beside Send instead of replacing it on an empty box, so a reply can be dictated in turns; Send now refuses a blank draft and a live clip. ([8faac43](https://github.com/memset0/herdr-fleet/commit/8faac43))

## [3.0.0] - 2026-09-04

### Added

- Renaming from the keyboard opens an input where the command bar opens, and `create-tab` now lands you in the tab it made. ([7932164](https://github.com/memset0/herdr-fleet/commit/7932164))
- A pending prefix shows what it leads to: pause after `Ctrl+B` and a compact panel lists your own second chords. ([c288f3d](https://github.com/memset0/herdr-fleet/commit/c288f3d))
- Drive Fleet from the keyboard: one command catalog, a `Ctrl+B` prefix, a `Ctrl+Shift+P` command bar that also finds a Pane, and Fleet's own settings document. ([f6533dd](https://github.com/memset0/herdr-fleet/commit/f6533dd))
- A Space row in the hierarchy opens a new Tab in that Space, through Collie's own create. ([ff9fe70](https://github.com/memset0/herdr-fleet/commit/ff9fe70))
- Establish the Herdr Fleet plugin identity, exact Collie fork boundary, and private Fleet configuration. ([255ba55](https://github.com/memset0/herdr-fleet/commit/255ba55))
- Reapply single-account Argon2id login with signed, revocable, host-only sessions and bounded attempts. ([be427df](https://github.com/memset0/herdr-fleet/commit/be427df))
- Gate one loopback Collie behind a same-origin authenticated Gateway with narrow proxy headers and redirects. ([b9b0e83](https://github.com/memset0/herdr-fleet/commit/b9b0e83))
- Run the Gateway and Collie under one generation-qualified Herdr Fleet supervisor without an operating-system service. ([54798c7](https://github.com/memset0/herdr-fleet/commit/54798c7))
- Require a fresh Gateway decision for every PWA navigation and document the private authenticated lead contract. ([f89da9d](https://github.com/memset0/herdr-fleet/commit/f89da9d))
- Restore bounded browser-local Agent favorites inside Collie's native triage lists. ([06e4611](https://github.com/memset0/herdr-fleet/commit/06e4611))
- Expose Collie's native Push-key generation and test delivery as Herdr Fleet actions. ([8a48446](https://github.com/memset0/herdr-fleet/commit/8a48446))
- Restore explicit Herdr Pane width fitting in native Display Settings. ([2bae845](https://github.com/memset0/herdr-fleet/commit/2bae845))
- Restore persistent native Space/Tab/Pane and Agent navigation sidebars. ([99fbfc4](https://github.com/memset0/herdr-fleet/commit/99fbfc4))
- Add role-aware Fleet lifecycle selection backed only by Collie's native Pack trust authority. ([325f505](https://github.com/memset0/herdr-fleet/commit/325f505))
- Give a native Pack peer one restricted, self-recovering SSH link that projects both loopback directions. ([55f9741](https://github.com/memset0/herdr-fleet/commit/55f9741))
- Enrol a Pack peer from Fleet itself, through Collie's own transitions, with no service manager anywhere in the path. ([f8e8f34](https://github.com/memset0/herdr-fleet/commit/f8e8f34))
- Show every pack member in both navigation rails, with each Agent row marked by the host it came from. ([aea2288](https://github.com/memset0/herdr-fleet/commit/aea2288))
- Say a member is unreachable only when the lead refuses it, and sink a refused member to the bottom of the rail, closed. ([c690712](https://github.com/memset0/herdr-fleet/commit/c690712))
- Believe that refusal only once the lead has missed more than one sweep, so a single slow exchange does not repaint the rail. ([4e1989f](https://github.com/memset0/herdr-fleet/commit/4e1989f))
- Add a fetched CJK fallback face under every font stack, chosen in Settings from a closed catalog and delivered in `unicode-range` pieces, so a mirror stays a grid in Chinese without shipping a font. ([f0d883e](https://github.com/memset0/herdr-fleet/commit/f0d883e))
- Offer that face as a Latin choice in the app's typeface and the terminal font pickers; it is the same family and the same download. ([f0d883e](https://github.com/memset0/herdr-fleet/commit/f0d883e))
- Refuse a commit that carries one of this fork's own deployment facts: a fourth pre-commit guard matches shapes rather than a list of values, reads the names that have no shape from the ignored local file, and says in its own output which case it cannot see. ([d2d6f1b](https://github.com/memset0/herdr-fleet/commit/d2d6f1b))

### Changed

- The row-actions menu closes on the first activation; the bottom sheet keeps its own arm-and-confirm on every device that gets it. ([d59824d](https://github.com/memset0/herdr-fleet/commit/d59824d))
- The row-actions menu takes a cursor's measurements and drops the caption naming the row it is standing on; the name stays as its accessible name. ([4830d28](https://github.com/memset0/herdr-fleet/commit/4830d28))
- A pointer's row actions are the fork's own context menu and centred prompt, chosen at the invoke site by the device; Collie's bottom sheet and its primitive are back to exactly upstream. ([5fddbb9](https://github.com/memset0/herdr-fleet/commit/5fddbb9))
- A Host row in the hierarchy draws its machine's own tinted glyph where the disclosure arrow was, and says in words when that machine is not answering. ([c8562f5](https://github.com/memset0/herdr-fleet/commit/c8562f5))
- The Agent rail row names its host with Collie's ordinary bordered chip, on the line of the text beside it, rather than the borderless caption form. ([797713a](https://github.com/memset0/herdr-fleet/commit/797713a))
- The machine a pane writes to is named in the app bar's trailing cluster instead of the composer's status band, so a pack no longer spends a row on one name. ([d59acb1](https://github.com/memset0/herdr-fleet/commit/d59acb1))
- The row-actions menu opens out of the cursor and wears a menu's chrome rather than a sheet's, the device rather than the gesture decides which surface it is, and the phone's hierarchy drawer is narrower. ([7fef833](https://github.com/memset0/herdr-fleet/commit/7fef833))
- A row's actions stand where the gesture asked: a menu at the cursor for a right-click, the bottom sheet for a long press, and the centre once they hold a rename's question. ([f3c4fb4](https://github.com/memset0/herdr-fleet/commit/f3c4fb4))
- The Agent rail reserves the card for the sections the dashboard reserves it for, and draws the rest as flat rows in one bordered group, so Ready · unseen stands out here as it does there. ([f3c4fb4](https://github.com/memset0/herdr-fleet/commit/f3c4fb4))
- The Agent rail's row wears Collie's own card — the same edge, ground, shadow and press — with the fork's reading order inside it and the card's own padding around it. ([2307f92](https://github.com/memset0/herdr-fleet/commit/2307f92))
- Both navigation rails stay expanded on a wide viewport, the header heads only the route column, and every route that is not a Pane fills that column. ([c2ddcdd](https://github.com/memset0/herdr-fleet/commit/c2ddcdd))
- The hierarchy is one Host heading over elided Space/Tab/Pane rows, with whole-row selection, one shared disclosure control, animated disclosure and a denser row. ([c2ddcdd](https://github.com/memset0/herdr-fleet/commit/c2ddcdd))
- On a narrow viewport the hierarchy opens from the header and the Pane page's switcher entry presents the Agent list; the shell's own trigger row is gone. ([c2ddcdd](https://github.com/memset0/herdr-fleet/commit/c2ddcdd))

- The hierarchy's Host is a row you can collapse, a Space row discloses instead of navigating away, and an elided single-Pane Tab keeps the name its operator chose rather than a terminal title every sibling repeats. ([6dd7637](https://github.com/memset0/herdr-fleet/commit/6dd7637))
- The hierarchy indents less, and neither rail's title is cut off from its list by a rule. ([6dd7637](https://github.com/memset0/herdr-fleet/commit/6dd7637))

- The pane's state is a badge at the end of the strip row rather than a band of its own; the composer keeps the word only where that row is not on screen. ([92585df](https://github.com/memset0/herdr-fleet/commit/92585df))
- The five controls under the mirror put their icon beside their word, and the display control gains one, so all five read as one rank. ([92585df](https://github.com/memset0/herdr-fleet/commit/92585df))
- The Pane route draws no Collie mark, and the header and both rails stand on the raised chrome ground the composer dock already uses. ([92585df](https://github.com/memset0/herdr-fleet/commit/92585df))
- Hierarchy rows carry the Tab row's own status dot, automatic disclosure fires only when the selected Pane changes, and the rails spend less width and height on their own chrome. ([92585df](https://github.com/memset0/herdr-fleet/commit/92585df))

- The hierarchy's state dot is one size smaller, the control row is shorter with larger type on one line box with its icons, and the rail separators no longer show a seam of page between the three columns. ([f3a294c](https://github.com/memset0/herdr-fleet/commit/f3a294c))
- A Pane label that is only digits is the multiplexer's ordinal, not a name, so an elided row keeps its Tab's name. ([f3a294c](https://github.com/memset0/herdr-fleet/commit/f3a294c))

- The Agent rail draws its own row over Collie's own triage order: the Agent's mark with the Pane's state and a shortcut ordinal badged at its corners, the Space then the work's name on line one with its age, and what the Pane is doing beneath. Collie's own Agent list and card are untouched. ([f39e9d1](https://github.com/memset0/herdr-fleet/commit/f39e9d1))
- The hierarchy's guide line falls on the centre of the control that opened its level, children begin one control-width in, and a row with no children draws no disclosure column. ([f39e9d1](https://github.com/memset0/herdr-fleet/commit/f39e9d1))

- A hierarchy row opens Collie's own Pane or Tab actions on a right-click or a long press, so a rename or a close is reachable from the tree; a Space row offers none, because the bridge defines none. ([b5d5b97](https://github.com/memset0/herdr-fleet/commit/b5d5b97))
- The Agent rail's rows have more air between them. ([b5d5b97](https://github.com/memset0/herdr-fleet/commit/b5d5b97))

- The strips fold automatically and only automatically: the manual control is gone, and the pane's state rides the folded bar as a word so the composer's band no longer comes back the moment the keyboard does. ([66de33d](https://github.com/memset0/herdr-fleet/commit/66de33d))
- The Agent rail's row puts its favourite control at the top-right and its age at the bottom-right, and the phone's hierarchy drawer wears the rail's own ground and title. ([66de33d](https://github.com/memset0/herdr-fleet/commit/66de33d))

- The hierarchy has one compact density at every width, and its rows carry their own horizontal padding. ([55f9741](https://github.com/memset0/herdr-fleet/commit/55f9741))

### Fixed

- A hierarchy row that took its Tab's slot renames and closes that Tab rather than the one Pane inside it, so a rename changes the name on screen and a close does not leave the container behind empty. ([75571b2](https://github.com/memset0/herdr-fleet/commit/75571b2))
- The hierarchy's guide line falls on its chevron's centre again — the row's own padding had moved the chevron and not the line — and the Agent row's age reaches the bottom trailing corner, because the reserve for the favourite control now belongs to the line that shares it rather than to the whole row. ([672e0b1](https://github.com/memset0/herdr-fleet/commit/672e0b1))
- Preserve an exact same-origin Referer fallback for browsers that omit Origin on the login form POST. ([2c73c24](https://github.com/memset0/herdr-fleet/commit/2c73c24))
- Accept header-stripped browser login submissions through an unguessable no-store CSRF form token. ([f3980b0](https://github.com/memset0/herdr-fleet/commit/f3980b0))
- Allow the authenticated same-origin UI to request microphone access without delegating it cross-origin. ([c21a57f](https://github.com/memset0/herdr-fleet/commit/c21a57f))
