## Why

The tree corresponds to Collie `v1.15.0` (tag object `1dba7de34afa9334a185f85e8f1d1947f4f723c3`,
commit `ef01b0ed4d9271897413984075aa6d2060ffcf2a`; Herdr Fleet 3.6.0, currently 3.9.14). Upstream has
since published `v1.15.1` through `v1.18.0`. `v1.17.2` (2026-10-06) is 386 commits over 769 files
past the baseline. It carries upstream's own fix for Claude's `esc to interrupt` and `↓ to manage`
status hints (`63bf5b61`, #330, released in 1.15.2). That fix covers the bug the fork's temporary
`claude-manage-hint-port` patches, so the port can retire. The owner chose `v1.17.2` over `v1.18.0`
for this adoption.

## What Changes

- Adopt Collie `v1.17.2` — tag object `b73f66bcafd40b75adc93abc838c7e5c49c30d00`, commit
  `3d562ae5f8ca1b5bcbf8c4cab10064c955d5c704` — as one three-way merge whose second parent is that
  commit, after a clean-tree preflight. The 19 predicted conflict paths are all inside declared
  entries. `CLAUDE.md` stays the relative symlink to `AGENTS.md`. The version files stay `3.9.14`
  until the release commit.
- **Retire `claude-manage-hint-port`.** `chrome.ts` and `index.ts` take upstream's `namesAModalKey`.
  The fork-owned recogniser `web/src/lib/fleet-claude-mode-line.ts` is removed, along with its suite,
  its four synthetic fixtures, the `claude-mode-line-compat` owned entry and the invasive entry.
  `fleet-harness-compat` loses the requirement. Fork scenarios that upstream's reading satisfies are
  kept as evidence until the change is verified, then removed with the suite. A scenario upstream
  does not satisfy is reported to the owner rather than kept as a port. One known gap is accepted: a
  right-aligned notice after `↓ to manage` on the same row is still read as a modal upstream. This
  gap will be reported upstream.
- **Keep `codex-headless-status-row-port`.** Upstream did not touch `codex/markers.ts`. Its headless
  multi-item status row is still unread.
- The fork's Chat gate follows upstream's new default. In 1.17.0 Chat became the default body of an
  agent Pane and the Experiments opt-in was removed. The fork's terminal surface still replaces
  whichever body Collie would draw, offers no Chat switch beneath it and starts no Chat read.
- The fork's other ports are reconciled with the release: `resize` and `files` cross the crew link
  side by side, the lint boundary list carries both sides, and the root `tsconfig.json` keeps
  `fleet` beside upstream's contract-test exclusions. Two upstream test changes also meet the
  rails' scoping ports: the new dashboard footer action and the pinned-row focus assertion.
- Review every invasive entry against `v1.17.2` and advance it to `reviewed = "v1.17.2"`. Set
  `[upstream]`, add the `UPSTREAM.md` row (`3.10.0` → `1.17.2`) and make `v1.17.2`'s changelog the
  byte-exact prefix of `COLLIE_CHANGELOG.md`.
- **The Gateway owns authentication** (owner decision, 2026-10-08). Collie's new Cloudflare Access
  gate settings `COLLIE_ACCESS_TEAM` and `COLLIE_ACCESS_AUD` become Fleet-owned. They are reset in
  the child's environment, and a Collie `config.toml` naming either refuses the generation.
- Release axis **MINOR, 3.9.14 → 3.10.0** (owner decision, 2026-10-08). The release is cut in a later
  phase, after the full suites have run on a designated member.

The release otherwise brings upstream's own work, none of which is specified here. That includes Chat
as the default Pane body, the Files view and the Machines page (`/api/{pane,workspace}/:id/files`,
`/api/machines*`, the crew snapshot's additive `machineStats`), the dashboard tabs Crew, Dashboard and
Files, Activity and Cache orders, and the Tern multiplexer. It also brings experimental Windows
support, Oh My Pi and Muse harness work, a `local-cli` speech provider, an opt-in Cloudflare Access
gate, crew invite and join addressing fixes (#334), and many reader fixes.

**Non-goals:**

- No specification of upstream behaviour, and no port beyond what the release requires.
- No Fleet ownership of the new Collie settings `COLLIE_MUX_ENDPOINT_TERN`, `COLLIE_TERN_BIN`,
  `COLLIE_MUSE_ROOT`, `COLLIE_STT_COMMAND` and `COLLIE_TASK_RUN_LEVEL`.
- No port of upstream's `CLAUDE.md` changes into `AGENTS.md`, as at every earlier adoption.
- No release, tag or push in this phase. Deployment belongs to the private parent repository.

## Capabilities

### New Capabilities

None. An adoption imports upstream behaviour, and upstream behaviour is not specified here.

### Modified Capabilities

- `fleet-harness-compat`: the Claude mode-line hint exemption is removed. Upstream reads those hints
  itself since Collie 1.15.2.
- `fleet-runtime-configuration`: Collie's Cloudflare Access gate settings are Fleet-owned.
- `fleet-pane-terminal`: Chat is no longer an opt-in. Collie's own body choice, Chat by default since
  Collie 1.17, applies under the mirror, and the terminal surface still replaces it.

`fleet-upstream-sync` carries no delta. This adoption follows it as written.

## Impact

- Everything Collie changed between `v1.15.0` and `v1.17.2`. Neither package manifest changes a
  dependency, and the root `typecheck` script gains upstream's `tsconfig.contract.json` pass. Crew
  protocol stays 2, the `machineStats` and `files` additions are additive, and `MIN_BUN` is unchanged.
- Predicted conflicts (read-only `git merge-tree`): 19 paths, every one inside a declared entry, with
  no owned path occupied. The preflight reports 21 disturbed and 8 untouched entries.
- Fork-owned files: `web/src/lib/fleet-claude-mode-line.ts`, its suite and fixtures (removed), and
  `FORK.toml`, `UPSTREAM.md`, `COLLIE_CHANGELOG.md` and `CHANGELOG.md`.
- Invasive files: ports in `bridge/`, `web/src/`, `web/e2e/`, `.oxlintrc.json`, `tsconfig.json` and
  the version files, as enumerated in `FORK.toml`.
- Operators: every member redeploys (MINOR), lead first. No Fleet configuration key, enrolment step or
  state file changes.
