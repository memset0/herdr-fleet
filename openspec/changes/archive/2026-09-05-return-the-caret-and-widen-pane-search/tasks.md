## 1. Returning the caret

- [x] 1.1 Add a fork-owned focus module that captures the composer's caret and returns it over a bounded settling window, honouring the offset rule, the moved-Pane rule, the already-typing guard and the panel's precedence; verify with unit tests over the real DOM covering capture, restore-to-offset, land-at-end, waiting for a composer that mounts late, following an element the pane swap replaces, a disabled composer, a standing panel, and cancellation
- [x] 1.2 Capture the caret in the dispatcher before any action runs and return it after every invocation, failed ones included, choosing end-of-field for the commands that move the operator; verify the existing dispatcher suite still passes
- [x] 1.3 Return the caret after the Pane switcher activates a row, at the end of the Pane it switched to
- [x] 1.4 Make the shared panel stop recording `body` as somewhere to return to, and fall back to the composer when what it recorded is gone; verify the panel, rename and confirmation suites still pass

## 2. Finding a Pane by every fact that names it

- [x] 2.1 Carry the Tab's name onto the roster entry, absent when the Tab says nothing, and map it from the field the bridge already denormalises; verify the root roster suite passes
- [x] 2.2 Name the four search fields and their order once, beside the roster entry, with a reader that turns a matched index back into a field name; verify the root roster suite passes
- [x] 2.3 Match Pane rows on all four fields, and show the matched fact in the row's single context slot with its characters marked; verify with command-bar tests that each of the four facts finds its own Pane and that the row shows the Tab or the host when that is what matched

## 3. Verification

- [x] 3.1 Run both typechecks, the linter, the root suite and the Fleet web suites, and record the results
- [x] 3.2 Add the `CHANGELOG.md` lines under `## [Unreleased]`, and assess the change against the release axis
