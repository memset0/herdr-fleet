# Changelog

Herdr Fleet's own changes are recorded here. Collie's are not: its changelog is retained exactly as
upstream wrote it in [`COLLIE_CHANGELOG.md`](./COLLIE_CHANGELOG.md), and unchanged Collie behaviour
is upstream behaviour rather than a release of ours. **Write in this file, not that one.**

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

### Changed

- A shortcut hands the caret back to the composer — same offset where it took one, end of the field otherwise, and end of the field after a command that moved you to another pane.
- The pane switcher matches a pane on its host, its space, its tab and its own name, and the row shows which of them it matched.
- Renaming is one surface with one save, whether it is reached from a key or from the row-actions menu.
- Every question the keyboard asks is one shared panel, and a confirmation's `y/N` sits in its heading rather than beside the field.
- Closing a tab or a pane from the keyboard now asks on the command bar's panel — `y/N`, already holding `y`, so Enter confirms and anything else declines.
- This product no longer publishes GitHub Releases: a pushed tag marks the version and triggers nothing, and the tag check says so.

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
