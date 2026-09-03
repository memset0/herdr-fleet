## 1. What a row count is

- [x] 1.1 Add the picker's bounds, the empty-field parser and the bounded per-device preference to the fork-owned fit module, and carry a chosen height through the fit runner.
- [x] 1.2 Cover the parser's ends, the store's refusals and its malformed records.

## 2. The wire

- [x] 2.1 Accept an optional bounded `rows` beside `cols`, keep reading the Pane's own height when it is absent, and refuse every other field as before.
- [x] 2.2 Carry the optional height from the client, omitted rather than null when there is none.
- [x] 2.3 Update the parser and action tests that used `rows` as their example of an unknown field.

## 3. The two controls

- [x] 3.1 Draw the action and the field as one fork-owned surface, applying a typed count when it settles and only when it changed, and hand the Pane page one callback.
- [x] 3.2 Cover the settle, the no-op retype, the empty field, the button, and the read-only case.

## 4. Verify and publish

- [x] 4.1 Run the owned, fit, Pane and i18n tests plus both typechecks, lint, the fork check and strict OpenSpec validation.
- [x] 4.2 Record the new fork-owned roots in `FORK.toml`, add a `CHANGELOG.md` line, commit, push, archive, and redeploy.
