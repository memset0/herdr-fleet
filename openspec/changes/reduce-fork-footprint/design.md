## Context

`bun scripts/check-fork.ts` reports 892 owned and 86 invasive paths in 29 invasive entries against
Collie v1.18.0. A read-only audit of those 86 paths separated real ports — a slot, an optional field,
an imported name in a file only upstream can change — from paths that are invasive only because fork
material was put inside an upstream file when a file of the fork's own could have carried it:

- fork cases appended to upstream test files;
- a fork override block in `.oxlintrc.json`, `fleet` in the root `tsconfig.json` include, a fork step
  and fetch depth in upstream's `ci.yml`, and a fork page in upstream's `docs/` with a test exclusion;
- a header fill changed in `app-header.tsx` plus a `paper` prop added to `collie-home.tsx`, when the
  ground can be set by the shell that wraps the header;
- eight upstream suites (component, playground and browser tier) edited only because the Fleet
  navigation shell is mounted under whatever Collie renders.

## Goals / Non-Goals

**Goals:** return every path in that second class to upstream's text, or shrink it to the port it
actually is; keep a Fleet build's behavior unchanged; keep coverage of the shell-on layout in
fork-owned tests. **Non-goals:** the owner-declined items (manual collapse control, dashboard
favorites, Maple font, the Pane page's mark), upstream's column-width cap, and the three upstream
fixes, which are prepared as upstream pull requests and retire their ports at a later sync.

## Decisions

### The shell is a build-time property of a Fleet build

`web/src/lib/fleet-build.ts` exports `isFleetBuild()`, which reads `import.meta.env.VITE_HERDR_FLEET`
at call time and answers true only for `"1"`. Vite inlines the value into a production bundle, and
Vitest's `vi.stubEnv` can set it per test, which is why the read is a function rather than a module
constant.

The variable is set in exactly one place: `web/package.json`'s `build` script
(`VITE_HERDR_FLEET=1 vite build`). That file is already a declared port (its version), and every
production bundle is built through that script — `collie build` runs it for Herdr's `[[build]]` step,
the lazy first build at start and the lead's deployment (`bun run build` at the root), and
`bun run build:web` calls it too. `fleet/build-flag.test.ts` pins the script and `collie build`'s use
of it, so a route that loses the statement fails a fork test rather than shipping a shell-less lead.
Upstream's own surfaces never set it: `cd web && bun run e2e` runs a bare `vite build`, and Vitest
sets nothing, so upstream's browser tier and component suites meet Collie's own layout.

An earlier draft prefixed the root `build` script and exported the variable from
`scripts/herdr-fleet.sh`; upstream's `scripts/build-cli.test.ts` pins the root script's exact text,
so that would have spent a new invasive path. The web script reaches every build route on its own.

Rejected — a runtime cookie or a Gateway-injected marker: it puts a request-time decision on a
structural layout, needs a first paint without the shell or a blocking read, and is the kind of
runtime switch the owner asked to avoid. Rejected — a default-on flag switched off by a Vitest
`.env.test`: it would revert the component suites but leave the five browser-tier specs edited,
because the browser tier serves a production build.

What the gate covers, and where it is read:

- `NativeNavigationShell` renders its children alone when `isFleetBuild()` is false — the DOM is then
  upstream's, and no navigation context exists;
- `NativeHierarchyToggle` and the Pane switcher already answer "nothing" outside that context;
- the Pane route's mark follows the same context: `agent-chat.tsx` passes `mark` as "no shell
  switcher is present" instead of a literal `false`, so the one hook it already calls decides both;
- `FleetSettingsSection` renders nothing outside a Fleet build.

Nothing in an upstream file reads the variable. A Fleet build is unchanged.

### Fork cases move to fork-owned test files

Each moved case keeps its assertions and copies only the small render helper it used from the
upstream file. New files: `web/src/lib/fleet-version-loader.test.ts`,
`web/src/components/fleet-task-composer.test.tsx`, `web/src/components/fleet-host-space-sheet.test.tsx`,
`web/src/components/fleet-agent-card-favorite.test.tsx`, `web/src/components/fleet-app-header.test.tsx`.
The shell-on layout cases from `root.test.tsx` (the rails beside the route column, the header first in
the route column, the inset counted once per column) move into
`web/src/components/native-navigation-shell.test.tsx`, which stubs the build flag on.

### Configuration extends instead of editing

- **Lint.** The four `.oxlintrc.json` files become six inline
  `// oxlint-disable-next-line anti-slop/no-runtime-typeof -- <reason>` comments in the three live
  files; `web/src/lib/fleet-settings.ts` has no `typeof` left and is simply dropped. oxlint honours
  the inline form (verified with a planted violation and with the comment removed). AGENTS.md's
  "zero disable comments" rule gains its one stated exception: a fork-owned parse boundary carries
  this one rule's suppression at the line, with its reason, rather than in upstream's config.
- **TypeScript.** `fleet/tsconfig.json` extends the root config and includes only `fleet`. The root
  `typecheck` script runs it as a third `tsc -p`; `package.json` is already a declared port. `collie build` and CI's root typecheck call that script, so coverage is unchanged.
- **Tests.** `bun test ./fleet` moves out of upstream's `test` script into a fork `test:fleet`
  script, run by the fork workflow and by the release gate. The pre-push hook's `bun run test` no
  longer runs the Fleet suites; the release gate's full run on the test member does.
- **CI.** `.github/workflows/fleet.yml` (fork-owned) runs the boundary check with full history, the
  Fleet suites, and the Fleet browser cases against a Fleet build. `ci.yml` is upstream's again.
  `web/e2e/fleet-todoist.spec.ts` skips itself unless the run states a Fleet build, because
  upstream's browser job builds without one.

### The Fleet page leaves `docs/`

`docs/herdr-fleet.md` moves to `fleet/README.md`, beside the code it documents, so upstream's
docs-embed test (every `docs/*.md` must be embedded) needs no exclusion. Its own links, AGENTS.md,
UPSTREAM.md, FORK.toml and the two fleet tests that read it follow. Links from outside this
repository are reported to its owner rather than edited from here.

### Header chrome by variable scope

The shell's route column sets `--background: var(--chrome)` on the `<header>` it holds as its first
child (`[&>header]:[--background:var(--chrome)]`). Collie's theme maps `bg-background` through
`@theme inline`, so the header's own upstream `bg-background` fill and the mark's upstream
`paper="var(--background)"` knockout both resolve to the chrome ground, and stay coupled by
construction. `collie-home.tsx` returns to upstream's text and `app-header.tsx` loses its fill change.
Elements inside the header that use the page token (the mark's lost-badge cut-out) now cut out in the
header's own ground, which is what upstream's coupling intends. Verified by screenshots of the header
and route in light and dark over CDP against a local build, before and after.

### Manifest

Entries lose the paths that returned; `lint-parse-boundary`, `fork-gate-in-ci` and `downstream-docs`
are removed; `fleet-build-port` narrows to `package.json`; the fork workflow joins `fork-governance`.
Two attributions are corrected rather than re-worded:

- the census read and its `FleetVersionView` type move from Collie's `web/src/lib/types.ts` and
  `web/src/lib/loaders.ts` into the fork-owned `web/src/lib/fleet-version-view.ts`, so `types.ts`
  carries only the AgentView's `bindingId`/`bindingSession` and is declared by
  `terminal-binding-pin-port`, and `unnarrowed-pack-rows-port` keeps only the loader;
- the Pane page's `bindingPane={agent}` hand-off to the composer is stated as
  `composer-voice-rank-port`'s port (riding `native-pane-page-port`'s declaration of that file).

`collie-home.tsx` leaving the boundary empties `native-pane-chrome-port`, so that entry now declares
`app-header.tsx` (its mark claim and lost badge), with the shell's leading slot riding it. The
remaining `pinned-panes.spec.ts` scoping is the favorites star's, so it moves to
`native-agent-favorites-port`. Result: 86 → 69 invasive paths, 29 → 26 entries.

## Risks / Trade-offs

- [A build route that forgets the flag ships a lead without its rails] → two build routes, both set
  it, and a fork test reads both; the lead deploy is checked visually.
- [Upstream suites no longer exercise the shell] → accepted by the owner; the shell's own suites
  stub the flag on and cover the rails, the header nesting, the inset and the switcher.
- [Fleet suites no longer run in the pre-push hook] → they run in the fork workflow and in the
  release gate's full run.
- [A descendant of the header that wanted the page colour now gets chrome] → checked visually; the
  only page-token use inside the row is the mark's own badge cut-out.
