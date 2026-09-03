## 1. The catalog and the preference

- [x] 1.1 Add the closed catalog and the versioned, size-bounded fallback preference under `fleet/ui/`, with the unset family name they both refer to.
- [x] 1.2 Cover the catalog's invariants and every refusal the preference makes, including storage that throws.

## 2. The document

- [x] 2.1 Add the DOM applier: one reused stylesheet element and one custom property, both idempotent, plus the resolver that maps the three choices to one catalog entry.
- [x] 2.2 Cover the resolver and both writes.

## 3. The stacks and the pickers

- [x] 3.1 Put `var(--font-cjk)` in every stack in `index.css` and in the terminal families' shared tail, and give the unset value its own `:root` declaration.
- [x] 3.2 Add the provider face to both pickers' closed lists, to the pre-paint class list, and as its own `:root` block, and update the picker tests that pin those lists.
- [x] 3.3 Add the settings card and mount it beneath the two it completes; mount the applier in the shell.
- [x] 3.4 Add every label to all six typed dictionaries.

## 4. The boundary

- [x] 4.1 Admit the provider origin in `style-src` and `font-src` only, leaving `script-src` and `connect-src` untouched, and say why at the line.
- [x] 4.2 Record the new owned roots and one invasive entry in `FORK.toml`, naming the three paths this capability shares with entries that already declare them.

## 5. Verify and publish

- [x] 5.1 Run the owned, webfont, picker, font and i18n tests plus both typechecks, lint, the fork check and strict OpenSpec validation.
- [x] 5.2 Add `CHANGELOG.md` lines, commit only this change's paths, push, archive, and redeploy the exact pushed commit.
