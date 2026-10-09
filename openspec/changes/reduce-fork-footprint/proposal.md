## Why

The fork boundary stands at 86 invasive paths against Collie v1.18.0, and a large share of them are
not ports at all: fork test cases appended to upstream test files, fork configuration written into
upstream configuration, a fork CI step inside upstream's workflow, a fork page inside upstream's
`docs/`, and upstream suites edited only because the Fleet navigation shell is mounted under them.
Every one of those paths is a merge the next adoption has to resolve by hand. The agreement says
invasiveness is minimised, not merely declared; this change spends the paths that can be returned.

## What Changes

- **Fork test cases leave upstream test files.** The Fleet cases in `web/src/lib/loaders.test.ts`,
  `web/src/components/composer.test.tsx`, `web/src/components/new-space-sheet.test.tsx`,
  `web/src/components/agent-card.test.tsx` and `web/src/components/app-header.test.tsx` move to
  fork-owned test files, and each upstream file returns to upstream's text where nothing else holds it.
- **Fork configuration stands beside upstream's.** `.oxlintrc.json` returns to upstream's text: the
  fork's parse boundaries carry an inline `no-runtime-typeof` suppression at each line instead, and a
  dead entry (`web/src/lib/fleet-settings.ts`) is dropped. `fleet/tsconfig.json` extends the root
  configuration and is checked by the root typecheck script, so the root `tsconfig.json` returns to
  upstream's text; `bun test ./fleet` leaves upstream's root `test` script for a fork script.
- **The boundary check runs from a fork-owned workflow**, so upstream's `ci.yml` returns to its text.
- **The Fleet runtime's page moves from `docs/herdr-fleet.md` to `fleet/README.md`**, so the
  docs-embed test needs no exclusion and returns to upstream's text.
- **The header's chrome ground is set by the shell, not by the header.** The Fleet shell scopes the
  page-colour variable to the chrome ground on the header it wraps, so `collie-home.tsx` returns to
  upstream's text and the header's fill stays upstream's `bg-background`.
- **The navigation shell is part of a Fleet build.** The Fleet build states it is one at build time;
  only such a bundle mounts the shell, its hierarchy trigger, its Agent-rail switcher, the Pane route's
  declined mark and the Fleet Settings group. A bundle built without it — upstream's component suites
  and browser tier — draws Collie's own layout, so the upstream tests that met the shell return to
  upstream's text. Fork-owned tests cover the shell-on layout.
- **FORK.toml is brought to the new boundary**, including two corrected attributions: the browser
  AgentView's `bindingId` fields belong to `terminal-binding-pin-port`, and the composer's
  `bindingPane` port is the task-delivery case of `composer-voice-rank-port`.

Baseline: Collie v1.18.0, unchanged. No product behavior changes in a Fleet build.

## Non-goals

- Restoring the manual tab/pane collapse control, retiring dashboard favorites, retiring the Maple
  font, or restoring the Pane page's mark: each was weighed and declined by the owner.
- Adopting upstream's centred column-width cap on any route.
- Upstream fixes for the crew focus audit name, the table corpus order and the headless Codex
  status row are prepared as upstream pull requests outside this repository; their ports retire at
  the sync that adopts them, not here.
- Any runtime switch for the shell: the decision is the build's, never a cookie or a request.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-native-navigation-sidebars`: the shell is mounted by a Fleet build, and a non-Fleet build
  draws Collie's layout.
- `fleet-pane-chrome`: the Pane route declines the mark inside the Fleet shell.
- `fleet-settings`: the Fleet group stands at the head of Settings in a Fleet build.
- `fleet-upstream-sync`: the boundary check runs in a fork-owned workflow, and the fork's own tests,
  lint suppressions, TypeScript configuration and documentation stand beside upstream's files.

## Impact

- Upstream-owned paths returned to upstream's text (target): `.oxlintrc.json`, `tsconfig.json`,
  `.github/workflows/ci.yml`, `cli/docs-embed.test.ts`, `web/src/components/collie-home.tsx`,
  `web/src/lib/loaders.test.ts`, `web/src/components/composer.test.tsx`,
  `web/src/components/new-space-sheet.test.tsx`, `web/src/components/agent-card.test.tsx`,
  `web/src/components/app-header.test.tsx`, `web/src/routes/root.test.tsx`,
  `web/src/routes/settings.test.tsx`, `web/src/playground/sections/motion.test.tsx`,
  `web/e2e/smoke.spec.ts`, `web/e2e/back-goes-up.spec.ts`, `web/e2e/pane-glide.spec.ts`,
  `web/e2e/dashboard-footer.spec.ts`.
- Narrowed upstream paths: `package.json` (typecheck and fork scripts), `web/src/components/app-header.tsx`
  (no fill change), `web/src/components/agent-chat.tsx` (mark follows the shell),
  `web/e2e/pinned-panes.spec.ts` (only the favorites scoping remains), `web/src/lib/types.ts` and
  `web/src/lib/loaders.ts` (the version view's read and type move to a fork module).
- Fork-owned: the shell's build gate, `web/src/lib/fleet-version-view.ts`, new fork test files, `fleet/tsconfig.json`,
  `.github/workflows/fleet.yml`, `fleet/README.md`; `web/package.json` states the Fleet build.
- Released as the MINOR the owner set for this work; every member redeploys.
