## Context

The rail and navigation shell are fork-owned. Native pins use `paneRowKey` plus `panePlaceParts(pane).space`; no agent identity is needed. The Gateway already authenticates requests and stores private operator data atomically. See proposal.md for scope and upstream baseline.

## Goals / Non-Goals

Keep tag behavior entirely in fork-owned modules with no peer wire or Collie snapshot changes. Preserve local pins, route semantics and the existing content density. Color-only display, filtering and catalog deletion are excluded.

## Decisions

- Add `fleet/pane-tags/` for a schema-1 catalog, associations and mutation validation. Definitions have stable IDs, normalized case-sensitive names and hex colors. Association identity is the native row key and workspace name. The UI reads native helpers rather than inventing a second identity algorithm.
- Store `pane-tags.json` beside Fleet's private configuration, with restrictive file permissions and atomic replacement. Serialize writes in the single Gateway process; hash each current document as its version. Read current disk content before each operation. Missing files mean empty state; malformed or unreadable files refuse operations. Whole-document client replacement was rejected because it makes unrelated lost updates too easy; use bounded attach-by-name, detach-by-ID and edit-definition commands with optimistic version checks.
- Add a single authenticated `/fleet/api/pane-tags` surface in the Gateway. It accepts no filesystem path and never forwards mutations to a peer or terminal. Colors are selected randomly on the server only when a new definition is created. Cap names, records and request bodies; reject duplicate names and dangling associations.
- A fork-owned provider around the native shell loads the catalog once and refreshes every 15 seconds while visible and not idle-paused, and on focus/visibility return or idle resume. All mounted rails and settings share it. Saves update it immediately; stale saves replace the visible snapshot and ask the operator to retry. Failed refreshes keep displayed data but disable mutations until recovery. There is no extra pane snapshot request or browser storage of tag state.
- Add a sibling tag control beside the star and a wrapping badge line beneath the original 44px content. Reuse Collapse for height changes. Use one focus-managed Fleet panel for assignment and global editing, with a search/create field, selectable existing tags and explicit global edit actions. Global editing is reachable from both the rail header and Fleet settings. Names remain readable in both themes; color is expressed as a swatch, border and tint rather than arbitrary low-contrast text.
- Follow the existing typed i18n dictionaries in all shipped languages. This is the only anticipated upstream-owned port; extend its existing FORK manifest entry. All product logic stays in owned modules. Extend the existing parsing-boundary lint entry only if typed JSON readers do not suffice.

## Risks / Trade-offs

- Native pane IDs can be reused even inside the same workspace name → retain the explicitly requested pin identity semantics; do not claim permanent agent identity.
- Concurrent browsers → optimistic versions and serialized atomic mutations prevent silent overwrite; a conflict requires retry.
- A second external process edits the file → not an advertised editing interface; durable validation refuses corruption. The Gateway is the sole supported writer.
- Large catalogs and long labels → bounded documents, search in the editor, wrapped readable labels and explicit limit errors.
- Browser refresh cadence → another visible browser reflects edits within 15 seconds; focus triggers an immediate refresh.

## Migration Plan

No existing data migrates; an absent file starts empty and local favorites remain untouched. Verify focused persistence/security/UI tests, both typechecks, lint, fork/privacy checks, full suites and build on the designated test runner. Archive only after verification. Publish and deploy the lead using the established procedure; peers need no deployment. The tag feature alone is a patch; the separately authorized speech deadline compatibility fix makes the combined release a minor, 3.6.0 to 3.7.0. Rollback restores the prior product build and leaves the unused tag document intact.

## Verification status

All implementation tasks and release gates pass. The designated runner completed the full root
script (bridge, CLI, scripts, Fleet and shell/packaging suites), the full browser suite, both
typechecks, full lint, fork checks and a production build. Private-tree checks and strict OpenSpec
validation pass. Real Chromium checks at 1920×1080 and 390×844 confirm the tag line and editor fit
without horizontal overflow; the new client/component tests cover stale edits and focus behavior.

The separately authorized `stabilize-baseline-tests` change resolves the two baseline defects
without removing tests or weakening assertions. An isolated temporary directory on local storage
avoids unrelated Git discovery metadata and network-filesystem fixture latency. This change is
complete at lead verification; the combined release's bridge correction requires member updates,
which are a rollout concern rather than a tag protocol migration.
