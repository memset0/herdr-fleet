## Context

See proposal.md. The mirror measures `clientWidth` minus its two `px-2` insets, so a classic scrollbar is already excluded. The terminal has the same padding but zero scrollback and no matching native scrollbar reservation. Both surfaces are alternate content, not simultaneously mounted mirrors.

## Goals / Non-Goals

**Goals:** reserve real native scrollbar space before the existing xterm FitAddon measures; preserve the existing padding, height and geometry lifecycle.

**Non-Goals:** inspect hidden mirror overflow, duplicate its layout, change font metrics, alter scrollback or compensate reported columns after fitting.

## Decisions

Use `scrollbar-gutter: stable` with `overflow: hidden` on the owned terminal host. Hidden overflow reserves a classic gutter without displaying a dead scrollbar; overlay engines reserve none. Avoid `both-edges`: the mirror has one scrollbar, not two. Existing `px-2` remains symmetric. xterm's existing child fills the resulting real content box and its own fit stays authoritative.

A fixed pixel subtraction fails across browser/platform scrollbar settings. A hidden measurement DOM and observer would reproduce a native CSS layout primitive at runtime. Neither is needed if browser verification confirms FitAddon consumes the narrowed child. No new upstream path or fork manifest boundary is introduced.

## Risks / Trade-offs

- A non-overflowing mirror is wider → explicitly accepted fixed overflowing-mirror target, no hidden content request.
- Different font rasterization may still round differently → assert parity with equal measured cells; do not change fonts or promise row parity between surfaces.
- Engines without stable-gutter support → verify supported current Chromium behavior and report compatibility limits, rather than inventing a hard-coded fallback.
- Hidden overflow could expose fit sizing assumptions → verify real xterm rendered first/last columns, desktop and phone widths, gutter toggles, and unchanged row count.

## Migration Plan

Frontend-only lead deployment; no peer or configuration migration. Build and deploy the reviewed lead commit after gates. Reverting the owned host style restores the former width. Preserve unrelated active changes. The operator explicitly selected a scoped frontend deployment without a version tag or peer updates after a backend test timeout in the validation environment blocked the complete gate.

## Verification evidence

Real Chromium rendered the actual FleetTerminal and ChatMessageList components with an overflowing
synthetic mirror. Removing only the new gutter property supplied the pre-fix control. With a 15px
classic scrollbar, route widths 640/390/320 changed terminal columns 104/62/50 to 101/59/48, exactly
matching the mirror's manual measurement in those cases. All retained 21 rows. A 10px thin-scrollbar
matrix and a zero-width policy also matched drawable widths and complete-cell renderer fits.
Chromium with native overlay scrollbars enabled reserved zero on both surfaces at all three widths.
Desktop and 390px phone screenshots confirmed visible edge markers and no page overflow; no manual
resize request occurred. Renderer rounding remained observable at individual cell boundaries, as
anticipated above, without a scrollbar-width mismatch.

Focused terminal and route coverage passed: 2 files, 26 tests. The local fork check is obstructed by
an unrelated, pre-existing untracked probe; it is excluded from the isolated candidate rather than
deleted or claimed by this change. The public-fact check passed its shape checks, with its explicit
warning that no local private-names block was available.

The isolated candidate's root suite timed out after 300s while running upstream speech tests.
The operator clarified that the earlier speech-test investigation had identified a device issue,
not a product defect; the retained planning record is not evidence of an unresolved source bug.
The operator approved reporting this run's timeout while requiring all frontend deployment gates.
Both typechecks, full lint, fork and public-fact audits, and the production build passed.
The full frontend suite passed on Node 22: 195 files, 5,256 tests, with 30 existing todo cases.
An initial remote shell lacked Node on PATH; selecting an installed Node corrected those tooling
invocations. Node 26 exposed incompatible localStorage behavior in the web suite; the successful
run used the existing Node 22 runtime rather than changing application or test code.
