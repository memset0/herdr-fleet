## 1. One report per route change

- [x] 1.1 Widen Collie's slow-load hook so a caller can decline the navigation signal entirely, and decline it from the root route.
- [x] 1.2 Cover the declined signal and the untouched ambient one.

## 2. One hierarchy

- [x] 2.1 Draw the hierarchy's rows at one compact height and type size at every width, and give a row its own horizontal padding.

## 3. Verify and publish

- [x] 3.1 Run the hook, tree and shell tests plus both typechecks, lint, the fork check and strict OpenSpec validation.
- [x] 3.2 Record the new invasive anchor in `FORK.toml`, add a `CHANGELOG.md` line, commit, push, archive, and redeploy.
