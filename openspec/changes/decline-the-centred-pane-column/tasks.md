## 1. Restore the width

- [x] 1.1 In `web/src/components/agent-chat.tsx`, drop `mx-auto` and `md:max-w-screen-md` from the content wrapper and replace upstream's centred-column comment with the fork's reason for declining it; verify the wrapper's classes equal the pre-merge string at `857660b^`
- [x] 1.2 In the same file, drop the `width="wide"` claim from its `RouteHeader` so the header returns to the default `full`; verify no `width` prop remains on it, as at `857660b^`
- [x] 1.3 In `web/src/routes/history.tsx`, make the same two changes and verify its wrapper equals the pre-merge string and it passes no `width` claim
- [x] 1.4 Verify nothing else from upstream `28255ae` was reverted: `app-header.tsx` still offers the `wide` claim and `ui/sheet.tsx` still caps sheets

## 2. Declare the boundary

- [x] 2.1 Extend the `native-manual-pane-fit-port` entry's reason in `FORK.toml` to carry the Pane page's declined cap as a further port on `web/src/components/agent-chat.tsx`, naming upstream `28255ae` and why its argument does not reach this fork
- [x] 2.2 Add a `FORK.toml` entry for `web/src/routes/history.tsx`, which no entry claims today, with its anchor, reason and `verify` list
- [x] 2.3 Verify `bun scripts/check-fork.ts` passes and `bun test scripts/check-fork.test.ts scripts/fork-manifest.test.ts` is green
- [x] 2.4 Verify the manifest change and the line changes are staged for the same commit

## 3. Verification

- [x] 3.1 Run the touched component suites — `web/src/components/app-header.test.tsx` and any Pane-page suite that asserts the header claim — and correct any expectation that upstream wrote for the centred column, since the behaviour it pins is the one being declined
- [x] 3.2 Run both typechecks and lint over the touched paths
- [x] 3.3 Verify in a browser at a viewport above the `md` breakpoint that a Pane fills the column between the rails and its header spans the same width, and that a phone-width viewport is unchanged — done at 390 / 1024 / 1400 / 2000px against a local build; at 2000px the column spans the full ~1393px between the rails rather than a centred 768px block
- [ ] 3.4 Run the complete suite on `nvl72-cluster` rather than this host, per the recorded testing rule, before the change is treated as commit-ready

## 4. Record and land

- [x] 4.1 Add one line under `## [Unreleased]` in `CHANGELOG.md` in the same commit, and verify the three version files are untouched
- [ ] 4.2 Verify `openspec validate decline-the-centred-pane-column --strict` passes and the staged diff contains only this change's paths, not the terminal change's
