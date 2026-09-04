## 1. The document reaches the recognizer

- [x] 1.1 Add a fork-owned hook that loads the settings document once, parses it with the same validator the Gateway uses, and answers the shipped defaults for an absent, unserved or unreadable document; verify unit coverage of each of those three cases
- [x] 1.2 Pass its bindings and prefix from the navigation shell to the command provider; verify the shell's existing tests still pass unchanged
- [x] 1.3 Re-read the document when the Settings page saves one, so a save takes effect without a reload; verify a test covers it

## 2. The test that was missing

- [x] 2.1 Add an end-to-end test that serves a document and then presses a key: an added binding fires, an unbound default stops firing, and a changed prefix arms instead of the shipped one; verify it fails if the shell stops passing the document

## 3. The panel stops stretching

- [x] 3.1 Stop the shared panel filling the viewport when a surface declares no height of its own; verify the rename input's panel is no taller than its content and the command bar keeps its own bounded height

## 4. Gates

- [x] 4.1 Run the owned suites, both typechecks, lint, the fork check and strict OpenSpec validation; verify all pass
- [ ] 4.2 Deploy and confirm on the real origin that the operator's own bindings now fire
